'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FieldRep {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  company_name: string;
  country: string;
  role: string;
  is_verified: boolean;
  created_at: string;
  avatar_url: string;
  // computed
  factoriesCount: number;
  suppliersCount: number;
  pendingCount: number;
  approvedCount: number;
  productsCount: number;
  products: any[];
  factories: AgentFactory[];
}

interface AgentFactory {
  id: string;
  company_name: string;
  factory_type: string;
  country: string;
  city: string;
  industry: string;
  contact_phone: string;
  contact_email: string;
  contact_name: string;
  registration_status: string;
  contact_status: string;
  created_at: string;
  license_submitted_at: string | null;
  trade_license_url: string;
  trade_license_filename: string;
  cr_document_url: string;
  factory_license_url: string;
  tax_id: string;
  additional_docs: any[];
  certifications: any[];
  main_products: any[];
  annual_capacity: string;
  website: string;
  address: string;
  notes: string;
}

interface AdminMessage {
  id: string;
  conversation_id: string;
  sender_role: string;
  message: string;
  created_at: string;
}

interface Props {
  fieldAgents: any[];
  agentFactories: any[];
  agentProducts: any[];
  agentLoading: boolean;
  onRefresh: () => void;
  adminUserId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  under_review: 'bg-blue-50 text-blue-700 border border-blue-200',
  approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border border-red-200',
  contacting: 'bg-sky-50 text-sky-700 border border-sky-200',
  awaiting_license_approval: 'bg-violet-50 text-violet-700 border border-violet-200',
  documents_submitted: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
  contacting: 'Contacting',
  awaiting_license_approval: 'Awaiting license',
  documents_submitted: 'Documents submitted',
  local_factory: 'Local factory',
  international_factory: 'International factory',
  local_supplier: 'Local supplier',
};

// ─── Factory Detail Card ──────────────────────────────────────────────────────

function FactoryDetailCard({ factory }: { factory: AgentFactory }) {
  const { t } = useLanguage();
  const ui = t.admin.fieldReps;
  const statusLabels: Record<string, string> = {
    pending: ui.pending,
    under_review: ui.underReview,
    approved: ui.approved,
    rejected: ui.rejected,
    contacting: ui.contacting,
    awaiting_license_approval: ui.awaitingLicense,
    documents_submitted: ui.documentsSubmitted,
    local_factory: ui.localFactory,
    international_factory: ui.internationalFactory,
    local_supplier: ui.localSupplier,
  };
  const [expanded, setExpanded] = useState(false);

  const hasDocuments =
    factory.trade_license_url ||
    factory.cr_document_url ||
    factory.factory_license_url ||
    (factory.additional_docs && factory.additional_docs.length > 0);

  const docTypeLabel: Record<string, string> = {
    license: 'ترخيص',
    registration: 'تسجيل',
    product_catalog: 'كتالوج منتجات',
    image: 'صورة',
    certificate: 'شهادة',
    other: 'أخرى',
  };

  return (
    <div className="bg-background rounded-xl border border-border overflow-hidden">
      {/* Card Header */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        {/* Type Icon */}
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
          factory.factory_type === 'local_supplier' ?'bg-purple-100'
            : factory.factory_type === 'international_factory' ?'bg-blue-100' :'bg-orange-100'
        }`}>
          <Icon
            name={factory.factory_type === 'local_supplier' ? 'ShoppingBagIcon' : 'BuildingOffice2Icon'}
            size={18}
            className={
              factory.factory_type === 'local_supplier' ?'text-purple-600'
                : factory.factory_type === 'international_factory' ?'text-blue-600' :'text-orange-600'
            }
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h5 className="font-bold text-foreground text-sm">{factory.company_name || '—'}</h5>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[factory.factory_type] || 'bg-muted text-muted-foreground border border-border'}`}>
              {statusLabels[factory.factory_type] || factory.factory_type}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[factory.registration_status] || 'bg-muted text-muted-foreground border border-border'}`}>
              {statusLabels[factory.registration_status] || factory.registration_status}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
            {(factory.city || factory.country) && (
              <span className="flex items-center gap-1">
                <Icon name="MapPinIcon" size={10} />
                {[factory.city, factory.country].filter(Boolean).join('، ')}
              </span>
            )}
            {factory.industry && (
              <span className="flex items-center gap-1">
                <Icon name="TagIcon" size={10} />
                {factory.industry}
              </span>
            )}
            {hasDocuments && (
              <span className="flex items-center gap-1 text-teal-600">
                <Icon name="DocumentCheckIcon" size={10} />
                {ui.uploadedDocs}
              </span>
            )}
          </div>
        </div>

        <Icon
          name="ChevronDownIcon"
          size={16}
          className={`text-muted-foreground shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-border p-4 space-y-4 bg-muted/10">
          {/* Contact Info */}
          <div>
            <h6 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
              <Icon name="PhoneIcon" size={12} className="text-teal-600" />
              {ui.contactInfo}
            </h6>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { label: ui.contactName, value: factory.contact_name, icon: 'UserIcon' },
                { label: ui.phone, value: factory.contact_phone, icon: 'PhoneIcon' },
                { label: ui.email, value: factory.contact_email, icon: 'EnvelopeIcon' },
                { label: ui.website, value: factory.website, icon: 'GlobeAltIcon' },
                { label: ui.address, value: factory.address, icon: 'MapPinIcon' },
                { label: ui.taxId, value: factory.tax_id, icon: 'IdentificationIcon' },
              ].map(item =>
                item.value ? (
                  <div key={item.label} className="flex items-start gap-2 bg-background rounded-lg p-2.5 border border-border">
                    <Icon name={item.icon as any} size={12} className="text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground">{item.label}</p>
                      {item.label === ui.website ? (
                        <a
                          href={item.value.startsWith('http') ? item.value : `https://${item.value}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-teal-600 hover:underline truncate block"
                        >
                          {item.value}
                        </a>
                      ) : (
                        <p className="text-xs font-semibold text-foreground truncate">{item.value}</p>
                      )}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          </div>

          {/* Business Info */}
          {(factory.annual_capacity || (factory.main_products && factory.main_products.length > 0) || (factory.certifications && factory.certifications.length > 0)) && (
            <div>
              <h6 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                <Icon name="BuildingOffice2Icon" size={12} className="text-orange-600" />
                معلومات الأعمال
              </h6>
              <div className="space-y-2">
                {factory.annual_capacity && (
                  <div className="flex items-center justify-between bg-background rounded-lg p-2.5 border border-border">
                    <span className="text-xs text-muted-foreground">{ui.annualCapacity}</span>
                    <span className="text-xs font-semibold text-foreground">{factory.annual_capacity}</span>
                  </div>
                )}
                {factory.main_products && factory.main_products.length > 0 && (
                  <div className="bg-background rounded-lg p-2.5 border border-border">
                    <p className="text-[10px] text-muted-foreground mb-1.5">{ui.mainProducts}</p>
                    <div className="flex flex-wrap gap-1">
                      {factory.main_products.map((p: any, i: number) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                          {typeof p === 'string' ? p : p.name || JSON.stringify(p)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {factory.certifications && factory.certifications.length > 0 && (
                  <div className="bg-background rounded-lg p-2.5 border border-border">
                    <p className="text-[10px] text-muted-foreground mb-1.5">{ui.certificates}</p>
                    <div className="flex flex-wrap gap-1">
                      {factory.certifications.map((c: any, i: number) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {typeof c === 'string' ? c : c.name || JSON.stringify(c)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Legal Documents */}
          <div>
            <h6 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
              <Icon name="DocumentTextIcon" size={12} className="text-indigo-600" />
              المستندات القانونية
            </h6>
            {!hasDocuments ? (
              <div className="bg-background rounded-lg p-3 border border-dashed border-border text-center">
                <p className="text-xs text-muted-foreground">{ui.noDocsYet}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {factory.trade_license_url && (
                  <a
                    href={factory.trade_license_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-background rounded-lg p-2.5 border border-border hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                      <Icon name="DocumentTextIcon" size={14} className="text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{ui.tradeLicense}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {factory.trade_license_filename || 'عرض المستند'}
                      </p>
                    </div>
                    <Icon name="ArrowTopRightOnSquareIcon" size={12} className="text-muted-foreground group-hover:text-indigo-600 shrink-0" />
                  </a>
                )}
                {factory.cr_document_url && (
                  <a
                    href={factory.cr_document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-background rounded-lg p-2.5 border border-border hover:border-teal-300 hover:bg-teal-50/30 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
                      <Icon name="BuildingLibraryIcon" size={14} className="text-teal-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{ui.commercialRegister}</p>
                      <p className="text-[10px] text-muted-foreground">عرض السجل التجاري</p>
                    </div>
                    <Icon name="ArrowTopRightOnSquareIcon" size={12} className="text-muted-foreground group-hover:text-teal-600 shrink-0" />
                  </a>
                )}
                {factory.factory_license_url && (
                  <a
                    href={factory.factory_license_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-background rounded-lg p-2.5 border border-border hover:border-orange-300 hover:bg-orange-50/30 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                      <Icon name="DocumentCheckIcon" size={14} className="text-orange-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">ترخيص المصنع</p>
                      <p className="text-[10px] text-muted-foreground">عرض ترخيص المصنع</p>
                    </div>
                    <Icon name="ArrowTopRightOnSquareIcon" size={12} className="text-muted-foreground group-hover:text-orange-600 shrink-0" />
                  </a>
                )}
                {factory.additional_docs && factory.additional_docs.map((doc: any, i: number) => (
                  doc?.file_url ? (
                    <a
                      key={i}
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 bg-background rounded-lg p-2.5 border border-border hover:border-blue-300 hover:bg-blue-50/30 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                        <Icon name="PaperClipIcon" size={14} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">
                          {doc.doc_type ? (docTypeLabel[doc.doc_type] || doc.doc_type) : `مستند إضافي ${i + 1}`}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{doc.file_name || 'عرض المستند'}</p>
                      </div>
                      <Icon name="ArrowTopRightOnSquareIcon" size={12} className="text-muted-foreground group-hover:text-blue-600 shrink-0" />
                    </a>
                  ) : null
                ))}
              </div>
            )}
          </div>

          {/* WhatsApp Activation Button — shown only for approved entities */}
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
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#1E1E1E', color: '#D4AF37', border: '1px solid #D4AF37' }}
              onClick={e => e.stopPropagation()}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              إرسال رابط التفعيل عبر واتساب
            </a>
          )}

          {/* Timestamps */}
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1 border-t border-border">
            <span>📅 تاريخ التسجيل: {formatDate(factory.created_at)}</span>
            {factory.license_submitted_at && (
              <span>📋 رفع الترخيص: {formatDate(factory.license_submitted_at)}</span>
            )}
          </div>

          {/* Notes */}
          {factory.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-amber-700 mb-1">ملاحظات</p>
              <p className="text-xs text-amber-800">{factory.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Expandable Rep Registrations ─────────────────────────────────────────────

function RepRegistrationsAccordion({ rep }: { rep: FieldRep }) {
  const [open, setOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'factory' | 'supplier'>('all');

  const filtered = rep.factories.filter(f => {
    if (typeFilter === 'factory') return f.factory_type !== 'local_supplier';
    if (typeFilter === 'supplier') return f.factory_type === 'local_supplier';
    return true;
  });

  return (
    <div className="mt-3 pt-3 border-t border-border">
      {/* Toggle Button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors text-sm font-semibold text-foreground"
      >
        <span className="flex items-center gap-2">
          <Icon name="ListBulletIcon" size={14} className="text-teal-600" />
          عرض المصانع والموردين المسجلين
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">
            {rep.factories.length}
          </span>
        </span>
        <Icon
          name="ChevronDownIcon"
          size={14}
          className={`text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expanded List */}
      {open && (
        <div className="mt-3 space-y-3">
          {/* Type Filter */}
          {rep.factories.length > 0 && (
            <div className="flex gap-2">
              {[
                { key: 'all', label: `الكل (${rep.factories.length})` },
                { key: 'factory', label: `مصانع (${rep.factoriesCount})` },
                { key: 'supplier', label: `موردون (${rep.suppliersCount})` },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setTypeFilter(tab.key as any)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    typeFilter === tab.key
                      ? 'bg-teal-600 text-white' :'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="bg-muted/30 rounded-xl p-6 text-center">
              <Icon name="BuildingOffice2Icon" size={28} className="mx-auto mb-2 text-muted-foreground opacity-40" />
              <p className="text-xs text-muted-foreground">
                {rep.factories.length === 0
                  ? 'لم يسجّل هذا المندوب أي مصانع أو موردين بعد' :'لا توجد نتائج لهذا التصنيف'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(factory => (
                <FactoryDetailCard key={factory.id} factory={factory} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Messaging Modal ──────────────────────────────────────────────────────────

function MessagingModal({
  rep,
  adminUserId,
  onClose,
}: {
  rep: FieldRep;
  adminUserId: string;
  onClose: () => void;
}) {
  const { t, dir, language, isRTL } = useLanguage();
  const ui = t.admin.fieldReps;
  const statusLabels: Record<string, string> = {
    pending: ui.pending,
    under_review: ui.underReview,
    approved: ui.approved,
    rejected: ui.rejected,
    contacting: ui.contacting,
    awaiting_license_approval: ui.awaitingLicense,
    documents_submitted: ui.documentsSubmitted,
    local_factory: ui.localFactory,
    international_factory: ui.internationalFactory,
    local_supplier: ui.localSupplier,
  };
  const supabase = createClient();
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [convId, setConvId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initConversation();
  }, [rep.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initConversation = async () => {
    setLoading(true);
    try {
      const { data: existing } = await supabase
        .from('admin_factory_conversations')
        .select('id')
        .eq('factory_user_id', rep.id)
        .maybeSingle();

      let cid = existing?.id;
      if (!cid) {
        const { data: created, error } = await supabase
          .from('admin_factory_conversations')
          .insert({
            factory_user_id: rep.id,
            factory_name: rep.full_name || rep.email,
            last_message: '',
            unread_by_admin: 0,
          })
          .select('id')
          .single();
        if (error) throw error;
        cid = created.id;
      }
      setConvId(cid);

      const { data: msgs } = await supabase
        .from('admin_factory_messages')
        .select('*')
        .eq('conversation_id', cid)
        .order('created_at', { ascending: true })
        .limit(100);

      setMessages(msgs || []);
    } catch (e) {
      console.error('Messaging init error:', e);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !convId) return;
    setSending(true);
    try {
      const { data: msg, error } = await supabase
        .from('admin_factory_messages')
        .insert({
          conversation_id: convId,
          sender_id: adminUserId,
          sender_role: 'admin',
          message: newMsg.trim(),
          msg_type: 'text',
        })
        .select()
        .single();
      if (error) throw error;

      await supabase
        .from('admin_factory_conversations')
        .update({ last_message: newMsg.trim(), last_message_at: new Date().toISOString() })
        .eq('id', convId);

      setMessages(prev => [...prev, msg]);
      setNewMsg('');
    } catch (e) {
      console.error('Send error:', e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
            <Icon name="UserCircleIcon" size={20} className="text-teal-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground text-sm truncate">{rep.full_name || rep.email}</p>
            <p className="text-xs text-muted-foreground truncate">{rep.email}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center shrink-0">
            <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Icon name="ChatBubbleLeftRightIcon" size={32} className="mx-auto mb-2 opacity-30" />
              <p>لا توجد رسائل بعد. ابدأ المحادثة مع المندوب.</p>
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.sender_role === 'admin' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                    msg.sender_role === 'admin' ?'bg-teal-600 text-white rounded-br-sm' :'bg-muted text-foreground rounded-bl-sm'
                  }`}
                >
                  <p className="leading-relaxed">{msg.message}</p>
                  <p className={`text-[10px] mt-1 ${msg.sender_role === 'admin' ? 'text-teal-100' : 'text-muted-foreground'}`}>
                    {formatDate(msg.created_at)}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <div className="px-4 py-3 border-t border-border shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMsg}
              onChange={e => setNewMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="اكتب رسالة للمندوب..."
              className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-right"
              dir={dir}
            />
            <button
              onClick={sendMessage}
              disabled={sending || !newMsg.trim()}
              className="w-10 h-10 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center transition-colors shrink-0"
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Icon name="PaperAirplaneIcon" size={16} className="text-white" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Rep Detail Modal ─────────────────────────────────────────────────────────

function AgentProductsModeration({
  products,
  onChanged,
}: {
  products: any[];
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [localState, setLocalState] = useState<Record<string, boolean>>({});

  const isLive = (p: any) => (p.id in localState ? localState[p.id] : !!p.is_active);

  const setActive = async (p: any, active: boolean) => {
    setBusyId(p.id);
    try {
      const { error } = await supabase
        .from('agent_products')
        .update({ is_active: active })
        .eq('id', p.id);
      if (error) throw error;
      setLocalState(prev => ({ ...prev, [p.id]: active }));
      onChanged();
    } catch (e) {
      console.error('Agent product moderation error:', e);
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = products.filter(p => !isLive(p)).length;

  return (
    <div>
      <h4 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
        <Icon name="CubeIcon" size={14} className="text-blue-600" />
        مراجعة المنتجات المرفوعة ({products.length})
        {pendingCount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-semibold">
            {pendingCount} قيد المراجعة
          </span>
        )}
      </h4>
      {products.length === 0 ? (
        <div className="bg-muted/30 rounded-xl p-6 text-center text-muted-foreground text-sm">
          لم يرفع هذا المندوب أي منتجات بعد
        </div>
      ) : (
        <div className="space-y-2">
          {products.map(p => {
            const live = isLive(p);
            return (
              <div key={p.id} className="flex items-center justify-between gap-3 bg-card border border-border rounded-xl p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{p.name_ar || p.name_en}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.wholesale_price ?? p.price} {p.currency} · {formatDate(p.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    live ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {live ? 'معتمد' : 'قيد المراجعة'}
                  </span>
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => setActive(p, !live)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-60 ${
                      live
                        ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' :'bg-emerald-600 text-white border-emerald-600 hover:opacity-90'
                    }`}
                  >
                    {live ? 'إيقاف' : 'اعتماد'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RepDetailModal({
  rep, onClose, onProductsChanged }: { rep: FieldRep; onClose: () => void; onProductsChanged: () => void }) {
  const { t, dir, language, isRTL } = useLanguage();
  const ui = t.admin.fieldReps;
  const statusLabels: Record<string, string> = {
    pending: ui.pending,
    under_review: ui.underReview,
    approved: ui.approved,
    rejected: ui.rejected,
    contacting: ui.contacting,
    awaiting_license_approval: ui.awaitingLicense,
    documents_submitted: ui.documentsSubmitted,
    local_factory: ui.localFactory,
    international_factory: ui.internationalFactory,
    local_supplier: ui.localSupplier,
  };
  const [typeFilter, setTypeFilter] = useState<'all' | 'factory' | 'supplier'>('all');

  const filtered = rep.factories.filter(f => {
    if (typeFilter === 'factory') return f.factory_type !== 'local_supplier';
    if (typeFilter === 'supplier') return f.factory_type === 'local_supplier';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card shrink-0">
        <div>
          <h3 className="font-bold text-foreground text-base">{language === "ar" ? `تفاصيل المندوب: ${rep.full_name || rep.phone}` : `Rep details: ${rep.full_name || rep.phone}`}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            جميع المصانع والموردين المسجلين مع بياناتهم الكاملة
          </p>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center">
          <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-5" dir={dir}>
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'إجمالي التسجيلات', value: rep.factoriesCount + rep.suppliersCount, color: 'bg-teal-50 text-teal-700 border-teal-200' },
            { label: ui.factories, value: rep.factoriesCount, color: 'bg-orange-50 text-orange-700 border-orange-200' },
            { label: ui.suppliers, value: rep.suppliersCount, color: 'bg-purple-50 text-purple-700 border-purple-200' },
            { label: 'منتجات مرفوعة', value: rep.productsCount, color: 'bg-blue-50 text-blue-700 border-blue-200' },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-3 text-center ${s.color}`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Rep Info */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-2">
          <h4 className="font-bold text-foreground text-sm mb-3 flex items-center gap-2">
            <Icon name="UserCircleIcon" size={14} className="text-teal-600" />
            معلومات المندوب
          </h4>
          {[
            { label: 'الاسم الكامل', value: rep.full_name },
            { label: ui.email, value: rep.email },
            { label: 'رقم الهاتف', value: rep.phone || '—' },
            { label: 'الشركة', value: rep.company_name || '—' },
            { label: 'الدولة', value: rep.country || '—' },
            { label: 'حالة التوثيق', value: rep.is_verified ? '✅ موثق' : '⏳ غير موثق' },
            { label: 'تاريخ الانضمام', value: formatDate(rep.created_at) },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className="text-xs font-semibold text-foreground">{item.value}</span>
            </div>
          ))}
        </div>

        {/* Factories & Suppliers */}
        <div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
              <Icon name="BuildingOffice2Icon" size={14} className="text-orange-600" />
              المصانع والموردون المسجلون ({rep.factories.length})
            </h4>
            {rep.factories.length > 0 && (
              <div className="flex gap-2">
                {[
                  { key: 'all', label: 'الكل' },
                  { key: 'factory', label: ui.factories },
                  { key: 'supplier', label: ui.suppliers },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setTypeFilter(tab.key as any)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      typeFilter === tab.key
                        ? 'bg-teal-600 text-white' :'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="bg-muted/30 rounded-xl p-6 text-center text-muted-foreground text-sm">
              <Icon name="BuildingOffice2Icon" size={32} className="mx-auto mb-2 opacity-30" />
              <p>
                {rep.factories.length === 0
                  ? 'لم يسجّل هذا المندوب أي مصانع أو موردين بعد' :'لا توجد نتائج لهذا التصنيف'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(f => (
                <FactoryDetailCard key={f.id} factory={f} />
              ))}
            </div>
          )}
        </div>

        {/* Product Moderation */}
        <AgentProductsModeration products={rep.products} onChanged={onProductsChanged} />
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function FieldRepresentativesPanel({
  fieldAgents,
  agentFactories,
  agentProducts,
  agentLoading,
  onRefresh,
  adminUserId,
}: Props) {
  const { t, dir, language, isRTL } = useLanguage();
  const ui = t.admin.fieldReps;
  const statusLabels: Record<string, string> = {
    pending: ui.pending,
    under_review: ui.underReview,
    approved: ui.approved,
    rejected: ui.rejected,
    contacting: ui.contacting,
    awaiting_license_approval: ui.awaitingLicense,
    documents_submitted: ui.documentsSubmitted,
    local_factory: ui.localFactory,
    international_factory: ui.internationalFactory,
    local_supplier: ui.localSupplier,
  };

  const [search, setSearch] = useState('');
  const [selectedRep, setSelectedRep] = useState<FieldRep | null>(null);
  const [messagingRep, setMessagingRep] = useState<FieldRep | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Build enriched reps list
  const enrichedReps: FieldRep[] = fieldAgents.map(agent => {
    const myFactories: AgentFactory[] = agentFactories.filter((f: any) => f.agent_id === agent.id);
    const myProducts = agentProducts.filter((p: any) => p.agent_id === agent.id);
    const factories = myFactories.filter(f => f.factory_type !== 'local_supplier');
    const suppliers = myFactories.filter(f => f.factory_type === 'local_supplier');
    const approved = myFactories.filter(f => f.registration_status === 'approved');
    const pending = myFactories.filter(f => f.registration_status === 'pending' || f.registration_status === 'under_review');

    return {
      ...agent,
      factoriesCount: factories.length,
      suppliersCount: suppliers.length,
      pendingCount: pending.length,
      approvedCount: approved.length,
      productsCount: myProducts.length,
      products: myProducts,
      factories: myFactories,
    };
  });

  const filtered = enrichedReps.filter(rep => {
    const q = search.toLowerCase();
    const matchSearch = !q || rep.full_name?.toLowerCase().includes(q) || rep.email?.toLowerCase().includes(q) || rep.phone?.includes(q);
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? rep.is_verified : !rep.is_verified);
    return matchSearch && matchStatus;
  });

  const totalFactories = enrichedReps.reduce((s, r) => s + r.factoriesCount, 0);
  const totalSuppliers = enrichedReps.reduce((s, r) => s + r.suppliersCount, 0);
  const totalApproved = enrichedReps.reduce((s, r) => s + r.approvedCount, 0);
  const totalPending = enrichedReps.reduce((s, r) => s + r.pendingCount, 0);

  if (agentLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        <span className="mr-3 text-muted-foreground text-sm">جارٍ تحميل بيانات المندوبين...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={dir}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-foreground">{ui.title}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{ui.subtitle}</p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors"
        >
          <Icon name="ArrowPathIcon" size={14} />
          تحديث
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي المندوبين', value: enrichedReps.length, icon: 'UserGroupIcon', color: 'bg-teal-50 text-teal-700 border-teal-200' },
          { label: 'مصانع مسجلة', value: totalFactories, icon: 'BuildingOffice2Icon', color: 'bg-orange-50 text-orange-700 border-orange-200' },
          { label: 'موردون مسجلون', value: totalSuppliers, icon: 'ShoppingBagIcon', color: 'bg-purple-50 text-purple-700 border-purple-200' },
          { label: 'تسجيلات معتمدة', value: totalApproved, icon: 'CheckBadgeIcon', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border p-4 ${stat.color}`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon name={stat.icon as any} size={16} />
              <span className="text-xs font-medium">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Pending badge */}
      {totalPending > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <Icon name="ExclamationTriangleIcon" size={16} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700 font-medium">
            يوجد <strong>{totalPending}</strong> تسجيل بانتظار المراجعة والاعتماد
          </p>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="MagnifyingGlassIcon" size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو البريد أو الهاتف..."
            className="w-full pr-9 pl-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 text-right"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="all">جميع المندوبين</option>
          <option value="active">موثقون</option>
          <option value="inactive">غير موثقين</option>
        </select>
      </div>

      {/* Reps List */}
      {filtered.length === 0 ? (
        <div className="bg-muted/30 rounded-2xl p-12 text-center">
          <Icon name="UserGroupIcon" size={40} className="mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-muted-foreground font-medium">
            {enrichedReps.length === 0
              ? 'لا يوجد مندوبون ميدانيون مسجلون في النظام بعد' :'لا توجد نتائج تطابق البحث'}
          </p>
          {enrichedReps.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              يمكن للمندوبين التسجيل عبر صفحة /agent/login
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(rep => (
            <div
              key={rep.id}
              className="bg-card rounded-2xl border border-border p-4 hover:border-teal-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                  {rep.avatar_url ? (
                    <img src={rep.avatar_url} alt={rep.full_name} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <Icon name="UserCircleIcon" size={24} className="text-teal-600" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-foreground text-sm">{rep.full_name || '—'}</h3>
                    {rep.is_verified && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        موثق
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{rep.email}</p>
                  {rep.phone && <p className="text-xs text-muted-foreground">{rep.phone}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    انضم: {formatDate(rep.created_at)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                  <button
                    onClick={() => setSelectedRep(rep)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-semibold transition-colors border border-teal-200"
                    title="عرض التفاصيل الكاملة"
                  >
                    <Icon name="EyeIcon" size={12} />
                    تفاصيل كاملة
                  </button>
                  <button
                    onClick={() => setMessagingRep(rep)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-colors border border-indigo-200"
                    title={ui.messageRep}
                  >
                    <Icon name="ChatBubbleLeftRightIcon" size={12} />
                    مراسلة
                  </button>
                </div>
              </div>

              {/* Stats Row */}
              <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: ui.factories, value: rep.factoriesCount, color: 'text-orange-600' },
                  { label: ui.suppliers, value: rep.suppliersCount, color: 'text-purple-600' },
                  { label: ui.approved, value: rep.approvedCount, color: 'text-emerald-600' },
                  { label: ui.pending, value: rep.pendingCount, color: rep.pendingCount > 0 ? 'text-amber-600' : 'text-muted-foreground' },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Expandable Registrations Accordion */}
              <RepRegistrationsAccordion rep={rep} />
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {selectedRep && (
        <RepDetailModal rep={selectedRep} onClose={() => setSelectedRep(null)} onProductsChanged={onRefresh} />
      )}
      {messagingRep && (
        <MessagingModal
          rep={messagingRep}
          adminUserId={adminUserId}
          onClose={() => setMessagingRep(null)}
        />
      )}
    </div>
  );
}
