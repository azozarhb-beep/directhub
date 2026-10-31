'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import { fetchUserProfileRow, stripMissingProfileColumns } from '@/lib/fetchUserProfile';

const CATEGORIES = [
  'Electronics & Technology', 'Machinery & Equipment', 'Textiles & Apparel',
  'Food & Agriculture', 'Construction Materials', 'Chemicals & Plastics',
  'Metals & Steel', 'Automotive Parts', 'Medical & Pharmaceuticals',
  'Furniture & Home', 'Packaging & Paper', 'Energy & Utilities',
  'Raw Materials', 'Office Supplies', 'Beauty & Personal Care',
  'Toys & Sports', 'Cleaning & Hygiene', 'Other',
];

interface SupplierProfileData {
  id: string;
  full_name: string;
  company_name: string | null;
  country: string | null;
  city: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  description?: string | null;
  seller_category?: string | null;
  year_established?: number | null;
  nearest_fob_port?: string | null;
  annual_production_capacity?: string | null;
  website_url?: string | null;
}

export default function SupplierProfilePage({ backPath = '/my-account' }: { backPath?: string } = {}) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [profile, setProfile] = useState<SupplierProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSupplier, setIsSupplier] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    company_name: '',
    full_name: '',
    description: '',
    seller_category: '',
    country: '',
    city: '',
    year_established: '',
    nearest_fob_port: '',
    annual_production_capacity: '',
    website_url: '',
  });

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    const fetchProfile = async () => {
      const { data, error } = await fetchUserProfileRow(
        supabase,
        user.id,
        'id, full_name, company_name, country, city, avatar_url, cover_url, cover_photo_url, description, seller_category, year_established, nearest_fob_port, annual_production_capacity, website_url'
      );
      if (error) {
        console.error('supplier profile fetch:', error.message);
      }
      if (data) {
        const meta = ((user as any)?.user_metadata ?? {}) as Record<string, any>;
        const supplierValues = ['commercial_supplier', 'local_supplier'];
        setIsSupplier(
          [meta.account_role, meta.user_role, meta.seller_category, data.seller_category]
            .map((v) => String(v ?? '').toLowerCase().trim())
            .some((v) => supplierValues.includes(v))
        );
        const cover = data.cover_url || data.cover_photo_url || null;
        setProfile({
          id: data.id,
          full_name: data.full_name || '',
          company_name: data.company_name ?? null,
          country: data.country ?? null,
          city: data.city ?? null,
          avatar_url: data.avatar_url ?? null,
          cover_url: cover,
          description: data.description ?? null,
          seller_category: data.seller_category ?? null,
          year_established: data.year_established ?? null,
          nearest_fob_port: data.nearest_fob_port ?? null,
          annual_production_capacity: data.annual_production_capacity ?? null,
          website_url: data.website_url ?? null,
        });
        setForm({
          company_name: data.company_name || '',
          full_name: data.full_name || '',
          description: data.description || '',
          seller_category: data.seller_category || '',
          country: data.country || '',
          city: data.city || '',
          year_established: data.year_established ? String(data.year_established) : '',
          nearest_fob_port: data.nearest_fob_port || '',
          annual_production_capacity: data.annual_production_capacity || '',
          website_url: data.website_url || '',
        });
        setLogoPreview(data.avatar_url || null);
        setCoverPreview(cover);
      }
      setLoading(false);
    };
    fetchProfile();
  }, [user, authLoading, router]);

  const handleImageSelect = useCallback((
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'logo' | 'cover'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (type === 'logo') { setLogoPreview(result); setLogoFile(file); }
      else { setCoverPreview(result); setCoverFile(file); }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const uploadImage = async (file: File, userId: string, kind: 'avatar' | 'cover'): Promise<string> => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${userId}/${kind}-${Date.now()}.${ext}`;
    // Profile avatar/cover are public-facing branding assets -> public product-images bucket
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(`profile/${path}`, file, { upsert: false, contentType: file.type });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('product-images').getPublicUrl(`profile/${path}`);
    return data.publicUrl;
  };

  const handleSave = async () => {
    if (!user || !profile) return;
    if (!form.company_name.trim()) {
      setError(isSupplier ? 'اسم المنشأة التجارية مطلوب' : 'اسم الشركة / المصنع مطلوب');
      return;
    }
    const yearVal = form.year_established.trim();
    if (yearVal && (!/^\d{4}$/.test(yearVal) || Number(yearVal) < 1800 || Number(yearVal) > new Date().getFullYear())) {
      setError('سنة التأسيس غير صحيحة');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let newLogoUrl = profile.avatar_url;
      let newCoverUrl = profile.cover_url;

      if (logoFile) {
        setUploadingLogo(true);
        newLogoUrl = await uploadImage(logoFile, profile.id, 'avatar');
        setUploadingLogo(false);
      }
      if (coverFile) {
        setUploadingCover(true);
        newCoverUrl = await uploadImage(coverFile, profile.id, 'cover');
        setUploadingCover(false);
      }

      const updates: Record<string, unknown> = {
        full_name: form.full_name.trim() || profile.full_name,
        company_name: form.company_name.trim() || null,
        country: form.country.trim() || null,
        city: form.city.trim() || null,
        year_established: yearVal ? Number(yearVal) : null,
        nearest_fob_port: form.nearest_fob_port.trim() || null,
        annual_production_capacity: form.annual_production_capacity.trim() || null,
        website_url: form.website_url.trim() || null,
        seller_category: form.seller_category || null,
        avatar_url: newLogoUrl,
        cover_photo_url: newCoverUrl,
        cover_url: newCoverUrl,
        description: form.description.trim() || null,
      };

      let dbError: { message: string } | null = null;
      let payload: Record<string, unknown> | null = updates;
      for (let i = 0; i < 6 && payload; i++) {
        const result = await supabase
          .from('user_profiles')
          .update(payload)
          .eq('id', profile.id);
        dbError = result.error;
        if (!dbError) break;
        payload = stripMissingProfileColumns(payload, dbError.message || '');
      }

      if (dbError) throw dbError;

      // Keep supplier_profiles in sync (public storefront reads this table)
      await supabase
        .from('supplier_profiles')
        .upsert(
          {
            user_id: profile.id,
            company_name: form.company_name.trim() || profile.full_name,
            description: form.description.trim() || '',
            country: form.country.trim() || '',
            city: form.city.trim() || '',
            logo_url: newLogoUrl || '',
            cover_url: newCoverUrl || '',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

      setProfile((prev) => prev ? { ...prev, ...updates } : prev);
      setLogoFile(null);
      setCoverFile(null);
      setSuccessMsg(isSupplier ? 'تم حفظ ملف المورد بنجاح ✓' : 'تم حفظ ملف المصنع بنجاح ✓');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setUploadingLogo(false);
      setUploadingCover(false);
      setError(err.message || 'فشل الحفظ، يرجى المحاولة مجدداً');
    } finally {
      setSaving(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mobile-safe-bottom">

        {/* Success Toast */}
        {successMsg && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3 bg-green-600 text-white rounded-2xl shadow-2xl text-sm font-bold">
            <Icon name="CheckCircleIcon" size={18} className="text-white shrink-0" />
            {successMsg}
          </div>
        )}

        {/* Page Header */}
        <div className="bg-foreground relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
          <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 relative z-10">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(backPath)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Back"
              >
                <Icon name="ArrowRightIcon" size={18} className="text-white" />
              </button>
              <div>
                <h1 className="text-xl font-extrabold text-white">{isSupplier ? 'إعدادات وتوثيق المورد' : 'ملف المصنع / المورد'}</h1>
                <p className="text-sm text-white/60 mt-0.5">{isSupplier ? 'تحديث بيانات منشأتك التجارية، الشعار وصورة الغلاف' : 'تحديث بيانات مصنعك، الشعار وصورة الغلاف'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left: Image Uploads */}
            <div className="lg:col-span-1 flex flex-col gap-5">

              {/* Cover Photo */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="relative h-36 bg-gradient-to-br from-orange-100 to-amber-50">
                  {coverPreview && (
                    <AppImage src={coverPreview} alt="Cover Photo" fill className="object-cover" />
                  )}
                  <div className="absolute inset-0 bg-black/10" />
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-black/50 hover:bg-black/70 text-white text-xs font-bold rounded-xl transition-colors backdrop-blur-sm"
                  >
                    <Icon name="CameraIcon" size={13} />
                    {uploadingCover ? 'جاري الرفع...' : 'تغيير الغلاف'}
                  </button>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => handleImageSelect(e, 'cover')}
                  />
                </div>
                <div className="p-4">
                  <p className="text-xs font-bold text-foreground mb-1">صورة الغلاف</p>
                  <p className="text-[11px] text-muted-foreground">تظهر في أعلى صفحة متجرك. الأبعاد المثالية: 1200×400</p>
                </div>
              </div>

              {/* Factory Logo */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <p className="text-sm font-extrabold text-foreground mb-4 flex items-center gap-2">
                  <Icon name="BuildingStorefrontIcon" size={16} className="text-orange-500" />
                  {isSupplier ? 'شعار المنشأة' : 'شعار المصنع'}
                </p>
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-border bg-gradient-to-br from-orange-100 to-amber-50 flex items-center justify-center">
                      {logoPreview ? (
                        <AppImage src={logoPreview} alt="Factory Logo" width={96} height={96} className="object-cover w-full h-full" />
                      ) : (
                        <span className="text-3xl font-extrabold text-orange-500">
                          {(form.company_name || profile.full_name || 'F').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center border-2 border-background hover:opacity-90 transition-opacity shadow-md"
                    >
                      {uploadingLogo
                        ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <Icon name="CameraIcon" size={14} className="text-white" />
                      }
                    </button>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleImageSelect(e, 'logo')}
                    />
                  </div>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="text-xs font-bold text-primary hover:opacity-70 transition-opacity"
                    >
                      {uploadingLogo ? 'جاري الرفع...' : 'رفع شعار جديد'}
                    </button>
                    <p className="text-[11px] text-muted-foreground mt-1">PNG أو JPG — حجم مربع مفضل</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Profile Form */}
            <div className="lg:col-span-2">
              <div className="bg-card border border-border rounded-2xl p-6">
                <h2 className="text-base font-extrabold text-foreground mb-6 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                    <Icon name="PencilSquareIcon" size={15} className="text-orange-600" />
                  </div>
                  {isSupplier ? 'بيانات المنشأة التجارية' : 'بيانات المصنع / المورد'}
                </h2>

                {error && (
                  <div className="mb-5 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-medium">
                    <Icon name="ExclamationCircleIcon" size={16} className="shrink-0" />
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-5" dir="rtl">

                  {/* Company Name */}
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                      {isSupplier ? 'اسم المنشأة التجارية' : 'اسم الشركة / المصنع'} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.company_name}
                      onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))}
                      placeholder={isSupplier ? 'مثال: مؤسسة النور للتجارة والتوريدات' : 'مثال: مصنع النور للصناعات'}
                      className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors placeholder:text-muted-foreground/50"
                    />
                  </div>

                  {/* Contact Name */}
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                      اسم المسؤول / جهة الاتصال
                    </label>
                    <input
                      type="text"
                      value={form.full_name}
                      onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                      placeholder="الاسم الكامل للمسؤول"
                      className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors placeholder:text-muted-foreground/50"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                      {isSupplier ? 'وصف المنشأة / نبذة تعريفية' : 'وصف المصنع / نبذة تعريفية'}
                    </label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder={isSupplier ? 'اكتب نبذة عن منشأتك التجارية والمنتجات التي تورّدها...' : 'اكتب نبذة عن مصنعك، منتجاتك، وخبرتك في الصناعة...'}
                      rows={4}
                      className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors placeholder:text-muted-foreground/50 resize-none"
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">{form.description.length}/500 حرف</p>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                      فئة المنتجات الرئيسية
                    </label>
                    <select
                      value={form.seller_category}
                      onChange={(e) => setForm((p) => ({ ...p, seller_category: e.target.value }))}
                      className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    >
                      <option value="">اختر الفئة الرئيسية</option>
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Country & City */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1.5">الدولة</label>
                      <input
                        type="text"
                        value={form.country}
                        onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
                        placeholder="مثال: اليمن"
                        className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors placeholder:text-muted-foreground/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1.5">المدينة</label>
                      <input
                        type="text"
                        value={form.city}
                        onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                        placeholder="مثال: صنعاء"
                        className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors placeholder:text-muted-foreground/50"
                      />
                    </div>
                  </div>

                  {/* B2B Fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1.5">سنة التأسيس / Year Established</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={form.year_established}
                        onChange={(e) => setForm((p) => ({ ...p, year_established: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                        placeholder="مثال: 2005"
                        className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors placeholder:text-muted-foreground/50"
                      />
                    </div>
                    {!isSupplier && (
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-1.5">أقرب ميناء تصدير / Nearest FOB Export Port</label>
                        <input
                          type="text"
                          value={form.nearest_fob_port}
                          onChange={(e) => setForm((p) => ({ ...p, nearest_fob_port: e.target.value }))}
                          placeholder="مثال: Mersin, Aden, Ningbo"
                          className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors placeholder:text-muted-foreground/50"
                        />
                      </div>
                    )}
                    {!isSupplier && (
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-1.5">الطاقة الإنتاجية السنوية / Annual Production Capacity</label>
                        <input
                          type="text"
                          value={form.annual_production_capacity}
                          onChange={(e) => setForm((p) => ({ ...p, annual_production_capacity: e.target.value }))}
                          placeholder="مثال: 5000 طن / سنة"
                          className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors placeholder:text-muted-foreground/50"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                        الموقع الإلكتروني للمنشأة / Official Website URL <span className="text-muted-foreground/60 font-medium">(اختياري)</span>
                      </label>
                      <input
                        type="url"
                        dir="ltr"
                        value={form.website_url}
                        onChange={(e) => setForm((p) => ({ ...p, website_url: e.target.value }))}
                        placeholder="https://www.example.com"
                        className="w-full px-4 py-3 border border-border rounded-xl bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors placeholder:text-muted-foreground/50"
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <Icon name="ShieldCheckIcon" size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed text-amber-800 font-medium">
                      لحماية الصفقات، لا تُعرض أرقام الهواتف ولا الروابط الخارجية للمشترين في المتجر العام. جميع الاستفسارات والمعاملات تتم حصرياً عبر المحادثة الآمنة داخل المنصة وطلبات عروض الأسعار الرسمية (RFQ).
                    </p>
                  </div>

                </div>

                {/* Save Button */}
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving || !form.company_name.trim()}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground text-sm font-extrabold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 shadow-md shadow-primary/20"
                  >
                    {saving ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> جاري الحفظ...</>
                    ) : (
                      <><Icon name="CheckIcon" size={16} /> حفظ التغييرات</>
                    )}
                  </button>
                  <button
                    onClick={() => router.push(backPath)}
                    className="px-5 py-3.5 border border-border text-sm font-bold rounded-xl hover:bg-muted transition-colors text-foreground"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
