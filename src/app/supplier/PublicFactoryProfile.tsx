'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

interface FactoryPublicProfile {
  factory_id: string;
  company_name: string | null;
  city: string;
  country_code: string;
  industry: string | null;
  annual_capacity: string | null;
  established_year: string | null;
  registration_status: string | null;
  commercial_register_number: string | null;
  commercial_register_verified: boolean;
}

interface CatalogItem {
  id: string;
  name: string;
  name_ar: string | null;
  category: string | null;
  unit: string | null;
  unit_price: number | null;
  minimum_order_qty: number | null;
  inventory_status: string | null;
  origin_country: string | null;
  image_url: string | null;
}

interface PublicFactoryProfileProps {
  factoryId: string;
}

const COUNTRY_NAMES: Record<string, { ar: string; en: string }> = {
  YE: { ar: 'اليمن', en: 'Yemen' },
  SA: { ar: 'السعودية', en: 'Saudi Arabia' },
  CN: { ar: 'الصين', en: 'China' },
  TR: { ar: 'تركيا', en: 'Turkey' },
  IN: { ar: 'الهند', en: 'India' },
  EG: { ar: 'مصر', en: 'Egypt' },
  AE: { ar: 'الإمارات', en: 'UAE' },
  OM: { ar: 'عمان', en: 'Oman' }
};

export default function PublicFactoryProfile({ factoryId }: PublicFactoryProfileProps) {
  const { language, dir } = useLanguage();
  const isAr = language === 'ar';
  const [profile, setProfile] = useState<FactoryPublicProfile | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const [{ data: p }, { data: c }] = await Promise.all([
        supabase.rpc('get_public_factory_profile', { p_ref: factoryId }),
        supabase.rpc('get_public_factory_catalog', { p_ref: factoryId })]
        );
        if (cancelled) return;
        const row = Array.isArray(p) ? p[0] : p;
        setProfile(row ?? null);
        setCatalog(Array.isArray(c) ? c : []);
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [factoryId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background" dir={dir}>
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <BottomNav />
      </div>);

  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background" dir={dir}>
        <Header />
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <h1 className="text-xl font-bold text-foreground mb-3">{isAr ? 'المصنع غير موجود' : 'Factory not found'}</h1>
          <Link href="/suppliers" className="text-primary text-sm font-semibold hover:underline">
            {isAr ? 'تصفح الموردين' : 'Browse suppliers'}
          </Link>
        </div>
        <BottomNav />
      </div>);

  }

  const countryName = COUNTRY_NAMES[profile.country_code]?.[isAr ? 'ar' : 'en'] || profile.country_code;
  const locationLine = `${profile.city ? `${profile.city}، ` : ''}${countryName} (${profile.country_code})`;

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={dir}>
      <Header />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 md:px-6 py-4 md:py-6 pb-36 md:pb-10">
        <div className="bg-card border border-border rounded-2xl p-5 md:p-7 mb-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center shrink-0">
              <Icon name="BuildingOffice2Icon" size={30} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-2xl font-extrabold text-foreground">
                {profile.company_name || (isAr ? 'مصنع مسجل' : 'Registered Factory')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{locationLine}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {profile.commercial_register_verified ?
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-bold">
                    <Icon name="CheckBadgeIcon" size={12} variant="solid" />
                    {isAr ? 'سجل تجاري موثّق' : 'Verified commercial registration'}
                  </span> :

                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[11px] font-bold">
                    {isAr ? 'قيد التوثيق' : 'Verification pending'}
                  </span>
                }
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-5 border-t border-border text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">{isAr ? 'رقم السجل التجاري' : 'Commercial register no.'}</dt>
              <dd className="font-semibold text-foreground mt-0.5">{profile.commercial_register_number || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{isAr ? 'المجال' : 'Industry'}</dt>
              <dd className="font-semibold text-foreground mt-0.5">{profile.industry || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{isAr ? 'الطاقة الإنتاجية' : 'Annual capacity'}</dt>
              <dd className="font-semibold text-foreground mt-0.5">{profile.annual_capacity || '—'}</dd>
            </div>
          </dl>
        </div>

        <h2 className="text-base font-bold text-foreground mb-3">{isAr ? 'كتالوج المصنع' : 'Factory catalog'}</h2>
        {catalog.length === 0 ?
        <p className="text-sm text-muted-foreground py-8 text-center bg-card border border-border rounded-2xl">
            {isAr ? 'لا توجد منتجات منشورة حالياً' : 'No published products yet'}
          </p> :

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {catalog.map((item) =>
          <Link
            key={item.id}
            href={`/product/${item.id}`}
            className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 hover:shadow-md transition-all flex flex-col">
                <div className="aspect-[4/3] bg-muted overflow-hidden">
                  <img
                src={item.image_url || '/assets/images/no_image.png'}
                alt={isAr && item.name_ar ? item.name_ar : item.name}
                className="w-full h-full object-cover"
                loading="lazy" />
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-bold text-foreground line-clamp-2">
                    {isAr && item.name_ar ? item.name_ar : item.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {Number(item.unit_price ?? 0).toLocaleString('en-US')} {isAr ? 'ر.ي' : 'YER'}
                    {item.unit ? ` / ${item.unit}` : ''}
                  </p>
                </div>
              </Link>
          )}
          </div>
        }
      </main>
      <Footer />
      <BottomNav />
    </div>);

}
