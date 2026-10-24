'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import AIProductAssistant from '@/components/AIProductAssistant';
import { MultilingualProductFields, SupplierLanguageBadge } from '@/components/LocalizedProductDisplay';
import { buildProductShareLinkNoPhone } from '@/lib/whatsappOrderLinks';
import TrustScoreBadge from '@/components/TrustScoreBadge';
import WarrantyInlineForm from './WarrantyInlineForm';
import FactoryDocumentUploadPanel from '@/components/manufacturer/FactoryDocumentUploadPanel';
import { useAuth } from '@/contexts/AuthContext';

interface Product {
  id: string;
  name: string;
  name_ar: string;
  description: string;
  description_ar: string;
  category: string;
  sku: string;
  unit: string;
  unit_price: number;
  minimum_order_qty: number;
  stock_quantity: number;
  inventory_status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued';
  origin_country: string;
  is_active: boolean;
  created_at: string;
  created_by_role?: 'agent' | 'manufacturer' | null;
  created_by_id?: string | null;
  created_by_name?: string | null;
  approval_status?: 'approved' | 'pending_factory_approval' | null;
  image_url?: string | null;
  primary_image_url?: string | null;
  images?: any[] | null;
}

const getProductThumb = (p: Product): string | null => {
  if (p.primary_image_url) return p.primary_image_url;
  if (p.image_url) return p.image_url;
  if (Array.isArray(p.images) && p.images.length > 0) {
    const first: any = p.images[0];
    const src = typeof first === 'string' ? first : first?.src;
    if (typeof src === 'string' && src) return src;
  }
  return null;
};

interface ProductFormData {
  name: string; name_ar: string; name_zh: string; name_tr: string;
  description: string; description_ar: string; description_zh: string; description_tr: string;
  specifications_en: string; specifications_ar: string;
  category: string; sku: string; unit: string; unit_price: string;
  minimum_order_qty: string; stock_quantity: string; inventory_status: string; origin_country: string;
}

const CATEGORIES = [
  { value: 'electronics', label: 'Electronics & Technology' },
  { value: 'machinery', label: 'Industrial Machinery' },
  { value: 'textiles', label: 'Textiles & Apparel' },
  { value: 'building', label: 'Building Materials' },
  { value: 'food', label: 'Food & Agriculture' },
  { value: 'chemicals', label: 'Chemicals & Plastics' },
  { value: 'auto', label: 'Auto Parts & Accessories' },
  { value: 'packaging', label: 'Packaging Solutions' },
  { value: 'energy', label: 'Energy & Power' },
  { value: 'medical', label: 'Medical & Healthcare' },
  { value: 'furniture', label: 'Furniture & Interiors' },
  { value: 'raw_materials', label: 'Raw Materials' },
  { value: 'other', label: 'Other' },
];

const STATUS_CONFIG = {
  in_stock: { label: 'in_stock', color: 'bg-green-100 text-green-700' },
  low_stock: { label: 'low_stock', color: 'bg-yellow-100 text-yellow-700' },
  out_of_stock: { label: 'out_of_stock', color: 'bg-red-100 text-red-700' },
  discontinued: { label: 'discontinued', color: 'bg-gray-100 text-gray-600' },
};

interface ProductsPanelProps {
  products: Product[];
  filteredProducts: Product[];
  sortedProducts: Product[];
  fetchLoading: boolean;
  showAddModal: boolean;
  setShowAddModal: (v: boolean) => void;
  editingProduct: Product | null;
  formData: ProductFormData;
  setFormData: (v: ProductFormData) => void;
  formLoading: boolean;
  formError: string;
  deleteId: string | null;
  setDeleteId: (v: string | null) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  filterCategory: string;
  setFilterCategory: (v: string) => void;
  filterSource: string;
  setFilterSource: (v: string) => void;
  handleApproveProduct: (product: Product) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  selectedProducts: Set<string>;
  setSelectedProducts: (v: Set<string>) => void;
  bulkActionLoading: boolean;
  productSort: { col: string; dir: 'asc' | 'desc' };
  toggleProductSort: (col: string) => void;
  factoryRegistration: any;
  canListProducts: boolean;
  hasDocuments: boolean;
  docGateLoading: boolean;
  showDocGate: boolean;
  setShowDocGate: (v: boolean) => void;
  docUploadSuccess: string;
  docUploadError: string;
  tradeLicenseFile: File | null;
  setTradeLicenseFile: (v: File | null) => void;
  mfgLicenseFile: File | null;
  setMfgLicenseFile: (v: File | null) => void;
  uploadingDocs: boolean;
  accountType: 'factory' | 'supplier';
  setAccountType: (v: 'factory' | 'supplier') => void;
  secondDocFile: File | null;
  setSecondDocFile: (v: File | null) => void;
  taxId: string;
  setTaxId: (v: string) => void;
  establishedYear: string;
  setEstablishedYear: (v: string) => void;
  trustPercentage: number;
  verifiedTier: 'unverified' | 'partial' | 'verified';
  missingDocuments: string[];
  inquirySending: boolean;
  inquirySent: boolean;
  inquiryError: string;
  handleOpenAddModal: () => void;
  handleFormSubmit: (e: React.FormEvent) => void;
  handleDelete: (id: string) => void;
  handleToggleActive: (product: Product) => void;
  handleBulkToggleActive: (isActive: boolean) => void;
  handleBulkDelete: () => void;
  handleDocumentUpload: (e: React.FormEvent) => void;
  handleAccreditationInquiry: () => void;
  openEditModal: (product: Product) => void;
  stats: { total: number; inStock: number; lowStock: number; outOfStock: number };
  SortIcon: React.FC<{ col: string }>;
  t: any;
  md: any;
  onDocumentsChanged?: () => void;
}

export default function ProductsPanel({
  products,
  filteredProducts,
  sortedProducts,
  fetchLoading,
  showAddModal,
  setShowAddModal,
  editingProduct,
  formData,
  setFormData,
  formLoading,
  formError,
  deleteId,
  setDeleteId,
  filterStatus,
  setFilterStatus,
  filterCategory,
  setFilterCategory,
  filterSource,
  setFilterSource,
  handleApproveProduct,
  searchQuery,
  setSearchQuery,
  selectedProducts,
  setSelectedProducts,
  bulkActionLoading,
  productSort,
  toggleProductSort,
  factoryRegistration,
  canListProducts,
  hasDocuments,
  docGateLoading,
  showDocGate,
  setShowDocGate,
  docUploadSuccess,
  docUploadError,
  tradeLicenseFile,
  setTradeLicenseFile,
  mfgLicenseFile,
  setMfgLicenseFile,
  uploadingDocs,
  accountType,
  setAccountType,
  secondDocFile,
  setSecondDocFile,
  taxId,
  setTaxId,
  establishedYear,
  setEstablishedYear,
  trustPercentage,
  verifiedTier,
  missingDocuments,
  inquirySending,
  inquirySent,
  inquiryError,
  handleOpenAddModal,
  handleFormSubmit,
  handleDelete,
  handleToggleActive,
  handleBulkToggleActive,
  handleBulkDelete,
  handleDocumentUpload,
  handleAccreditationInquiry,
  openEditModal,
  stats,
  SortIcon,
  t,
  md,
  onDocumentsChanged,
}: ProductsPanelProps) {
  const { language } = useLanguage();
  const { user: authUser } = useAuth();
  const [showVerifiedDetails, setShowVerifiedDetails] = React.useState(false);
  const isFullyVerified = verifiedTier === 'verified' && trustPercentage >= 100;
  const isAgentManaged = !!(
    factoryRegistration?.agent_id ||
    factoryRegistration?.referred_by_agent_id ||
    factoryRegistration?.referred_by_agent_code ||
    factoryRegistration?.registration_type === 'agent'
  );
  const noopUploadDocs = () => {};
  const isAr = language === 'ar';
  const isPending = (p: Product) => p.approval_status === 'pending_factory_approval';
  const renderOriginBadge = (p: Product) =>
    p.created_by_role === 'agent' ? (
      <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
        <Icon name="UserIcon" size={10} />
        {isAr ? `أُدرج بواسطة المندوب: ${p.created_by_name || '—'}` : `Listed by agent: ${p.created_by_name || '—'}`}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        <Icon name="BuildingOffice2Icon" size={10} />
        {isAr ? 'إدراج ذاتي' : 'Self-listed'}
      </span>
    );
  const renderStatus = (p: Product) =>
    isPending(p) ? (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
        {isAr ? 'بانتظار تأكيد المصنع' : 'Pending factory approval'}
      </span>
    ) : (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[p.inventory_status]?.color || 'bg-gray-100 text-gray-600'}`}>
        {t.status[p.inventory_status as keyof typeof t.status] || p.inventory_status}
      </span>
    );
  const renderReviewButton = (p: Product, full?: boolean) =>
    isPending(p) ? (
      <>
        <button
          onClick={() => handleApproveProduct(p)}
          className={`${full ? 'flex-1 h-8' : 'h-8 px-2.5'} inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors`}
        >
          <Icon name="CheckCircleIcon" size={13} />
          {isAr ? 'اعتماد' : 'Approve'}
        </button>
        <button
          onClick={() => openEditModal(p)}
          className={`${full ? 'flex-1 h-8' : 'h-8 px-2.5'} inline-flex items-center justify-center gap-1 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition-colors`}
        >
          <Icon name="ClipboardDocumentCheckIcon" size={13} />
          {isAr ? 'مراجعة وتعديل' : 'Review & edit'}
        </button>
      </>
    ) : null;

  return (
    <>
      {/* Document Upload Success Banner */}
      {docUploadSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4 flex items-start gap-3">
          <Icon name="CheckCircleIcon" size={18} className="text-green-600 shrink-0 mt-0.5" />
          <p className="text-sm text-green-700">{docUploadSuccess}</p>
        </div>
      )}

      {/* Trust Score Card */}
      {!docGateLoading && factoryRegistration && isFullyVerified && (
        <div className="mb-4">
          <div className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
            <Icon name="CheckCircleIcon" size={18} className="text-emerald-600 shrink-0" />
            <span className="flex-1 min-w-0 text-xs sm:text-sm font-bold leading-snug">
              حساب المصنع موثق بالكامل بنسبة 100% (السجل التجاري والترخيص الصناعي)
            </span>
            <button
              type="button"
              onClick={() => setShowVerifiedDetails((v) => !v)}
              aria-expanded={showVerifiedDetails}
              className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-900 transition-colors"
            >
              <span className="hidden sm:inline">عرض التفاصيل</span>
              <Icon name="ChevronDownIcon" size={14} className={`transition-transform ${showVerifiedDetails ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {showVerifiedDetails && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[
                { key: 'trade_license', label: 'السجل التجاري' },
                { key: 'manufacturing_license', label: 'الترخيص الصناعي' },
              ].map((doc) => (
                <div key={doc.key} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium border bg-emerald-50 border-emerald-200 text-emerald-700">
                  <Icon name="CheckCircleIcon" size={12} className="text-emerald-600 shrink-0" />
                  <span className="truncate">{doc.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {!docGateLoading && factoryRegistration && !isFullyVerified && (
        <div className="relative mb-4 overflow-hidden rounded-2xl border shadow-md" style={{ background: verifiedTier === 'verified' ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' : verifiedTier === 'partial' ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' : 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)', borderColor: verifiedTier === 'verified' ? '#6ee7b7' : verifiedTier === 'partial' ? '#fcd34d' : '#e5e7eb' }}>
          <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: verifiedTier === 'verified' ? 'linear-gradient(90deg, transparent, #10B981, transparent)' : verifiedTier === 'partial' ? 'linear-gradient(90deg, transparent, #F59E0B, transparent)' : 'linear-gradient(90deg, transparent, #9CA3AF, transparent)' }} />
          <div className="px-5 py-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-gray-800">درجة التوثيق</span>
                  {verifiedTier === 'verified' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                      <Icon name="CheckBadgeIcon" size={10} className="text-white" />
                      موثق 100%
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {verifiedTier === 'verified' ? 'مصنعك حاصل على أعلى مستوى توثيق — أولوية في المطابقة الذكية' : verifiedTier === 'partial' ? 'أكمل المستندات الناقصة للوصول إلى 100% والحصول على شارة "موثق"' : 'ارفع مستنداتك للحصول على درجة توثيق وزيادة الظهور'}
                </p>
              </div>
              <TrustScoreBadge percentage={trustPercentage} tier={verifiedTier} showPrompt={false} size="md" />
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-500">التقدم نحو التوثيق الكامل</span>
                <span className="text-[10px] font-bold" style={{ color: verifiedTier === 'verified' ? '#059669' : verifiedTier === 'partial' ? '#D97706' : '#6B7280' }}>{trustPercentage}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${trustPercentage}%`, background: verifiedTier === 'verified' ? 'linear-gradient(90deg, #10B981, #059669)' : verifiedTier === 'partial' ? 'linear-gradient(90deg, #F59E0B, #D97706)' : 'linear-gradient(90deg, #9CA3AF, #6B7280)' }} />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { key: 'trade_license', label: 'السجل التجاري', hasDoc: !!factoryRegistration?.trade_license_url },
                { key: 'manufacturing_license', label: 'الترخيص الصناعي', hasDoc: !!factoryRegistration?.manufacturing_license_url },
              ].map((doc) => (
                <div key={doc.key} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-medium border ${doc.hasDoc ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
                  <Icon name={doc.hasDoc ? 'CheckCircleIcon' : 'XCircleIcon'} size={11} className={doc.hasDoc ? 'text-emerald-600 shrink-0' : 'text-red-400 shrink-0'} />
                  <span className="truncate">{doc.label}</span>
                </div>
              ))}
            </div>
            {verifiedTier !== 'verified' && missingDocuments.length > 0 && !isAgentManaged && (
              <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-white/70 border border-amber-200 rounded-xl">
                <Icon name="ArrowUpTrayIcon" size={13} className="text-amber-600 shrink-0" />
                <span className="text-[11px] text-amber-700 font-medium">
                  ارفع المستندات الناقصة للوصول إلى 100% والحصول على شارة <strong>موثق</strong> وأولوية في نتائج البحث
                </span>
                <button onClick={() => setShowDocGate(true)} className="ms-auto shrink-0 text-[10px] bg-amber-600 text-white px-2.5 py-1 rounded-lg hover:bg-amber-700 transition-colors font-bold">
                  رفع الآن
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Listing Gate Banner */}
      {!docGateLoading && !canListProducts && (
        <div className="relative mb-6 overflow-hidden rounded-2xl border border-amber-200/80 shadow-lg shadow-amber-100/50" style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fde68a20 100%)' }}>
          <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg, transparent, #D97706, #F59E0B, #D97706, transparent)' }} />
          <div className="px-5 py-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md" style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
                {hasDocuments ? <Icon name="ClockIcon" size={22} className="text-white" /> : <Icon name="LockClosedIcon" size={22} className="text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-bold text-amber-900 text-base leading-tight">
                    {hasDocuments ? t.manufacturerDashboard.documentsUnderReview : t.manufacturerDashboard.completeDocuments}
                  </p>
                  {hasDocuments && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      قيد المراجعة
                    </span>
                  )}
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  {hasDocuments
                    ? t.manufacturerDashboard.documentsUnderReviewDesc
                    : isAgentManaged
                    ? (language === 'ar' ?'مندوبك المعتمد مسؤول عن جمع ورفع مستندات التوثيق الخاصة بمصنعك. لا حاجة لرفعها بنفسك.' :'Your assigned agent is responsible for collecting and uploading your KYC documents. No action is needed from you.')
                    : t.manufacturerDashboard.completeDocumentsDesc}
                </p>
                <div className="flex flex-wrap items-center gap-2.5 mt-3">
                  {!hasDocuments && !isAgentManaged && (
                    <button onClick={() => setShowDocGate(true)} className="inline-flex items-center gap-1.5 px-4 py-2 text-white text-xs font-bold rounded-xl shadow-sm transition-all hover:shadow-md active:scale-95" style={{ background: 'linear-gradient(135deg, #D97706, #B45309)' }}>
                      <Icon name="ArrowUpTrayIcon" size={13} />
                      {t.manufacturerDashboard.uploadDocumentsNow}
                    </button>
                  )}
                  {hasDocuments && (
                    <button onClick={handleAccreditationInquiry} disabled={inquirySending || inquirySent} className="inline-flex items-center gap-2 px-5 py-2.5 text-white text-sm font-bold rounded-xl shadow-md transition-all hover:shadow-lg active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed" style={{ background: inquirySent ? 'linear-gradient(135deg, #059669, #047857)' : 'linear-gradient(135deg, #1E1E2E, #2D2D44)', border: '1px solid rgba(212,175,55,0.6)' }}>
                      {inquirySending ? <><Icon name="ArrowPathIcon" size={14} className="animate-spin" /><span>جارٍ الإرسال...</span></> : inquirySent ? <><Icon name="CheckCircleIcon" size={14} /><span>تم إرسال الاستفسار ✓</span></> : <><Icon name="BellAlertIcon" size={14} className="text-yellow-400" /><span>استفسر عن حالة الاعتماد</span></>}
                    </button>
                  )}
                </div>
                {inquirySent && (
                  <div className="mt-2.5 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-medium">
                    <Icon name="CheckBadgeIcon" size={14} className="text-emerald-600 shrink-0" />
                    تم إشعار فريق الإدارة باستفسارك. سيتواصل معك المسؤول قريباً.
                  </div>
                )}
                {inquiryError && (
                  <div className="mt-2.5 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                    <Icon name="ExclamationCircleIcon" size={14} className="text-red-500 shrink-0" />
                    {inquiryError}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, #F59E0B40, transparent)' }} />
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { labelKey: 'totalProducts', filter: 'all', value: stats.total, icon: 'CubeIcon', gradient: 'linear-gradient(135deg, #6366F1, #4F46E5)', shadow: 'shadow-indigo-100', ring: 'border-indigo-500 ring-2 ring-indigo-500/40' },
          { labelKey: 'inStock', filter: 'in_stock', value: stats.inStock ?? 0, icon: 'CheckCircleIcon', gradient: 'linear-gradient(135deg, #10B981, #059669)', shadow: 'shadow-emerald-100', ring: 'border-emerald-500 ring-2 ring-emerald-500/40' },
          { labelKey: 'lowStock', filter: 'low_stock', value: stats.lowStock ?? 0, icon: 'ExclamationTriangleIcon', gradient: 'linear-gradient(135deg, #F59E0B, #D97706)', shadow: 'shadow-amber-100', ring: 'border-amber-500 ring-2 ring-amber-500/40' },
          { labelKey: 'outOfStock', filter: 'out_of_stock', value: stats.outOfStock ?? 0, icon: 'XCircleIcon', gradient: 'linear-gradient(135deg, #EF4444, #DC2626)', shadow: 'shadow-red-100', ring: 'border-red-500 ring-2 ring-red-500/40' },
        ].map((stat) => {
          const isActiveCard = filterStatus === stat.filter;
          return (
            <button
              type="button"
              key={stat.labelKey}
              onClick={() => setFilterStatus(stat.filter)}
              aria-pressed={isActiveCard}
              className={`relative flex flex-col items-stretch text-start bg-card border rounded-2xl p-4 shadow-md ${stat.shadow} overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 cursor-pointer ${isActiveCard ? stat.ring : 'border-border/60'}`}
            >
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-5 -translate-y-4 translate-x-4 pointer-events-none" style={{ background: stat.gradient }} />
              <div className="relative flex items-center gap-2.5 mb-3">
                <div className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center shadow-sm" style={{ background: stat.gradient }}>
                  <Icon name={stat.icon as any} size={16} className="text-white" />
                </div>
                <span className="text-xs text-muted-foreground font-semibold leading-tight">
                  {t.manufacturerDashboard[stat.labelKey as keyof typeof t.manufacturerDashboard] as string}
                </span>
              </div>
              <p className="relative text-3xl font-black text-foreground tracking-tight leading-none">{stat.value}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[180px]">
          <div className="relative">
            <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder={t.manufacturerDashboard.searchByNameOrSku} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-9 pl-9 pr-4 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors" />
          </div>
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors">
          <option value="all">{t.manufacturerDashboard.allStatuses}</option>
          <option value="in_stock">{t.manufacturerDashboard.inStock}</option>
          <option value="low_stock">{t.manufacturerDashboard.lowStock}</option>
          <option value="out_of_stock">{t.manufacturerDashboard.outOfStock}</option>
          <option value="discontinued">{t.manufacturerDashboard.discontinued}</option>
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors">
          <option value="all">{t.manufacturerDashboard.allCategories}</option>
          {CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
        </select>
        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors">
          <option value="all">{isAr ? 'الكل' : 'All'}</option>
          <option value="mine">{isAr ? 'أضفتها بنفسي' : 'Added by Me'}</option>
          <option value="agent">{isAr ? 'أضافها المندوب' : 'Added by Agent'}</option>
        </select>
      </div>

      {/* Products Table / List */}
      {fetchLoading ? (
        <div className="flex items-center justify-center py-20">
          <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Icon name="CubeIcon" size={28} className="text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">
            {products.length === 0 ? t.manufacturerDashboard.noProductsYet : t.manufacturerDashboard.noProductsMatch}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {products.length === 0 ? t.manufacturerDashboard.addFirstProduct : t.manufacturerDashboard.tryAdjustingFilters}
          </p>
          {products.length === 0 && (
            <button onClick={handleOpenAddModal} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg">
              <Icon name="PlusIcon" size={16} /> {t.manufacturerDashboard.addFirstProductBtn}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.manufacturerDashboard.product}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.manufacturerDashboard.category}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.manufacturerDashboard.sku}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.manufacturerDashboard.pricePerUnit}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.manufacturerDashboard.stock}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.manufacturerDashboard.status}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t.manufacturerDashboard.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className={`hover:bg-muted/30 transition-colors ${!product.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden shrink-0 border border-border flex items-center justify-center">
                          {getProductThumb(product) ? (
                            <img src={getProductThumb(product) as string} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <Icon name="PhotoIcon" size={20} className="text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                      <p className="font-medium text-foreground break-words">{product.name}</p>
                      {renderOriginBadge(product)}
                      {product.origin_country && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-xs text-muted-foreground">{product.origin_country}</p>
                          <SupplierLanguageBadge originCountry={product.origin_country} size="sm" />
                        </div>
                      )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs text-muted-foreground capitalize">{product.category.replace('_', ' ')}</span></td>
                    <td className="px-4 py-3"><span className="font-mono text-xs text-muted-foreground">{product.sku || '—'}</span></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap" dir="ltr"><span className="font-semibold text-foreground">${product.unit_price.toFixed(2)}</span><span className="text-xs text-muted-foreground"> / {product.unit}</span></td>
                    <td className="px-4 py-3 text-right"><span className="font-medium text-foreground">{product.stock_quantity}</span><span className="text-xs text-muted-foreground"> {product.unit}</span></td>
                    <td className="px-4 py-3">
                      {renderStatus(product)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {renderReviewButton(product)}
                        <a href={`/product/${product.id}`} target="_blank" rel="noopener noreferrer" className="px-2 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-xs font-semibold text-primary whitespace-nowrap">
                          معاينة صفحة المنتج ↗
                        </a>
                        <a href={buildProductShareLinkNoPhone(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net'}/product/${product.id}`, language === 'ar')} target="_blank" rel="noopener noreferrer" title={language === 'ar' ? 'مشاركة عبر واتساب' : 'Share via WhatsApp'} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-green-50 transition-colors text-muted-foreground hover:text-green-600">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        </a>
                        <button onClick={() => handleToggleActive(product)} title={product.is_active ? t.manufacturerDashboard.deactivate : t.manufacturerDashboard.activate} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                          <Icon name={product.is_active ? 'EyeIcon' : 'EyeSlashIcon'} size={15} />
                        </button>
                        <button onClick={() => openEditModal(product)} title={t.manufacturerDashboard.edit} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                          <Icon name="PencilSquareIcon" size={15} />
                        </button>
                        <button onClick={() => setDeleteId(product.id)} title={t.manufacturerDashboard.delete} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600">
                          <Icon name="TrashIcon" size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-border">
            {filteredProducts.map((product) => (
              <div key={product.id} className={`p-4 ${!product.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="w-14 h-14 rounded-xl bg-muted overflow-hidden shrink-0 border border-border flex items-center justify-center">
                    {getProductThumb(product) ? (
                      <img src={getProductThumb(product) as string} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <Icon name="PhotoIcon" size={22} className="text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground break-words">{product.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{product.category.replace('_', ' ')}</p>
                    {renderOriginBadge(product)}
                  </div>
                  <span className="shrink-0">{renderStatus(product)}</span>
                </div>
                <div className="flex items-center gap-4 text-sm mb-3">
                  <span dir="ltr" className="whitespace-nowrap"><span className="font-semibold text-foreground">${product.unit_price.toFixed(2)}</span><span className="text-muted-foreground"> / {product.unit}</span></span>
                  <span className="text-muted-foreground">Stock: <span className="text-foreground font-medium">{product.stock_quantity} {product.unit}</span></span>
                </div>
                {isPending(product) && (
                  <div className="flex items-center gap-2 mb-2">{renderReviewButton(product, true)}</div>
                )}
                <a href={`/product/${product.id}`} target="_blank" rel="noopener noreferrer" className="mb-2 h-8 flex items-center justify-center rounded-lg border border-primary/30 text-xs font-semibold text-primary hover:bg-primary/5 transition-colors">
                  معاينة صفحة المنتج ↗
                </a>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggleActive(product)} className="flex-1 h-8 flex items-center justify-center gap-1 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                    <Icon name={product.is_active ? 'EyeIcon' : 'EyeSlashIcon'} size={13} />
                    {product.is_active ? (isAr ? 'نشط' : 'Active') : (isAr ? 'غير نشط' : 'Inactive')}
                  </button>
                  <button onClick={() => openEditModal(product)} className="flex-1 h-8 flex items-center justify-center gap-1 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                    <Icon name="PencilSquareIcon" size={13} /> {isAr ? 'تعديل' : 'Edit'}
                  </button>
                  <button onClick={() => setDeleteId(product.id)} className="flex-1 h-8 flex items-center justify-center gap-1 rounded-lg border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors">
                    <Icon name="TrashIcon" size={13} /> {isAr ? 'حذف' : 'Delete'}
                  </button>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-700">
                  <WarrantyInlineForm productId={product.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
          <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
              <h2 className="font-bold text-foreground">{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
              <div className="flex items-center gap-2">
                <AIProductAssistant categorySlug={formData.category} categoryName={CATEGORIES.find((c) => c.value === formData.category)?.label} productName={formData.name} />
                <button onClick={() => setShowAddModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                  <Icon name="XMarkIcon" size={18} />
                </button>
              </div>
            </div>
            <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
                  <Icon name="ExclamationCircleIcon" size={16} /> {formError}
                </div>
              )}
              <MultilingualProductFields
                originCountry={formData.origin_country}
                fields={{ name: formData.name, name_ar: formData.name_ar, name_zh: formData.name_zh, name_tr: formData.name_tr, description: formData.description, description_ar: formData.description_ar, description_zh: formData.description_zh, description_tr: formData.description_tr }}
                onChange={(field, value) => setFormData({ ...formData, [field]: value })}
                disabled={formLoading}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Category *</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors">
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">SKU / Code</label>
                  <input type="text" value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} placeholder="e.g. STL-001" className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Unit</label>
                  <select value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors">
                    {['kg', 'ton', 'liter', 'piece', 'meter', 'sheet', 'roll', 'box', 'pallet'].map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Unit Price ($)</label>
                  <input type="number" min="0" step="0.01" value={formData.unit_price} onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })} placeholder="0.00" className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Min. Order</label>
                  <input type="number" min="1" value={formData.minimum_order_qty} onChange={(e) => setFormData({ ...formData, minimum_order_qty: e.target.value })} placeholder="1" className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Stock Quantity</label>
                  <input type="number" min="0" step="0.01" value={formData.stock_quantity} onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })} placeholder="0" className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Inventory Status</label>
                  <select value={formData.inventory_status} onChange={(e) => setFormData({ ...formData, inventory_status: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors">
                    <option value="in_stock">In Stock</option>
                    <option value="low_stock">Low Stock</option>
                    <option value="out_of_stock">Out of Stock</option>
                    <option value="discontinued">Discontinued</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Origin Country
                  {formData.origin_country && <SupplierLanguageBadge originCountry={formData.origin_country} size="sm" />}
                </label>
                <select value={formData.origin_country} onChange={(e) => setFormData({ ...formData, origin_country: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors">
                  <option value="">Select country</option>
                  <optgroup label="🌏 Asia">
                    <option value="China">🇨🇳 China</option><option value="India">🇮🇳 India</option><option value="Turkey">🇹🇷 Turkey</option><option value="Japan">🇯🇵 Japan</option><option value="South Korea">🇰🇷 South Korea</option><option value="Taiwan">🇹🇼 Taiwan</option><option value="Vietnam">🇻🇳 Vietnam</option><option value="Bangladesh">🇧🇩 Bangladesh</option><option value="Pakistan">🇵🇰 Pakistan</option><option value="Indonesia">🇮🇩 Indonesia</option><option value="Malaysia">🇲🇾 Malaysia</option><option value="Thailand">🇹🇭 Thailand</option>
                  </optgroup>
                  <optgroup label="🌍 Arab Countries">
                    <option value="Saudi Arabia">🇸🇦 Saudi Arabia</option><option value="UAE">🇦🇪 UAE</option><option value="Kuwait">🇰🇼 Kuwait</option><option value="Qatar">🇶🇦 Qatar</option><option value="Bahrain">🇧🇭 Bahrain</option><option value="Oman">🇴🇲 Oman</option><option value="Egypt">🇪🇬 Egypt</option><option value="Jordan">🇯🇴 Jordan</option><option value="Iraq">🇮🇶 Iraq</option><option value="Yemen">🇾🇪 Yemen</option><option value="Morocco">🇲🇦 Morocco</option><option value="Algeria">🇩🇿 Algeria</option><option value="Tunisia">🇹🇳 Tunisia</option><option value="Libya">🇱🇾 Libya</option>
                  </optgroup>
                  <optgroup label="🌍 Europe">
                    <option value="Germany">🇩🇪 Germany</option><option value="Italy">🇮🇹 Italy</option><option value="France">🇫🇷 France</option><option value="UK">🇬🇧 UK</option><option value="Spain">🇪🇸 Spain</option><option value="Poland">🇵🇱 Poland</option><option value="Netherlands">🇳🇱 Netherlands</option>
                  </optgroup>
                  <optgroup label="🌎 Americas">
                    <option value="USA">🇺🇸 USA</option><option value="Canada">🇨🇦 Canada</option><option value="Brazil">🇧🇷 Brazil</option><option value="Mexico">🇲🇽 Mexico</option>
                  </optgroup>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 h-10 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" disabled={formLoading} className="flex-1 h-10 bg-primary text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity active:opacity-80">
                  {formLoading ? <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Saving...</> : (editingProduct ? (editingProduct.approval_status === 'pending_factory_approval' ? (isAr ? 'حفظ واعتماد' : 'Save & Approve') : 'Save Changes') : 'Add Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm bg-card rounded-2xl border border-border shadow-xl p-6">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Icon name="TrashIcon" size={22} className="text-red-600" />
            </div>
            <h3 className="text-center font-bold text-foreground mb-1">{isAr ? 'حذف المنتج؟' : 'Delete Product?'}</h3>
            <p className="text-center text-sm text-muted-foreground mb-5">{isAr ? 'لا يمكن التراجع عن هذا الإجراء. سيتم حذف المنتج نهائياً.' : 'This action cannot be undone. The product will be permanently removed.'}</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 h-10 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">{isAr ? 'إلغاء' : 'Cancel'}</button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 h-10 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors">{isAr ? 'حذف' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Document Gate Modal */}
      {showDocGate && !isAgentManaged && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 px-4 py-6 overflow-y-auto">
          <div className="w-full max-w-3xl bg-card rounded-2xl border border-border shadow-xl overflow-hidden">
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <Icon name="LockClosedIcon" size={20} className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-amber-900 text-base">{md.completeDocsActivate}</h3>
                <p className="text-xs text-amber-700 mt-0.5">Upload your legal documents to unlock product listings</p>
              </div>
              <button onClick={() => setShowDocGate(false)} className="ml-auto text-amber-600 hover:text-amber-800">
                <Icon name="XMarkIcon" size={20} />
              </button>
            </div>
            <div className="p-4 sm:p-6 max-h-[80vh] overflow-y-auto">
              {authUser?.id && (
                <FactoryDocumentUploadPanel userId={authUser.id} onUploaded={onDocumentsChanged} />
              )}
              <div className="flex justify-end pt-4">
                <button type="button" onClick={() => setShowDocGate(false)} className="h-10 px-5 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                  {t?.common?.close || 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
