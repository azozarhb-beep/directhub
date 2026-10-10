'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import SupplierReviews from '@/components/SupplierReviews';
import { createClient } from '@/lib/supabase/client';
import { maskContactInfo } from '@/lib/privacyShield';
import { useLanguage } from '@/contexts/LanguageContext';

interface SupplierProfile {
  id: string;
  user_id: string;
  company_name: string;
  description: string;
  country: string;
  city: string;
  established_year: number | null;
  employee_count: string;
  annual_revenue: string;
  main_categories: string[];
  certifications: string[];
  logo_url: string;
  cover_url: string;
  website: string;
  tier: 'standard' | 'verified' | 'premium';
  is_verified: boolean;
  response_rate: number;
  avg_response_time: string;
  total_rfqs_received: number;
  rating: number;
  review_count: number;
}

const TIER_COLORS = {
  premium: 'bg-amber-100 text-amber-700 border-amber-200',
  verified: 'bg-blue-100 text-blue-700 border-blue-200',
  standard: 'bg-gray-100 text-gray-600 border-gray-200',
} as const;

export default function SupplierDetailPage() {
  const { t, dir } = useLanguage();
  const sd = t.supplierDetail;
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [supplier, setSupplier] = useState<SupplierProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('supplier_profiles')
          .select('*')
          .eq('id', id)
          .single();
        if (data) setSupplier(data);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    if (id) fetch();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background" dir={dir}>
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="min-h-screen bg-background" dir={dir}>
        <Header />
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <h1 className="text-xl font-bold text-foreground mb-3">{sd.notFound}</h1>
          <Link href="/suppliers" className="text-primary text-sm font-semibold hover:underline">
            Back to Supplier Directory
          </Link>
        </div>
        <BottomNav />
      </div>
    );
  }

  const tierLabel = supplier.tier === 'premium' ? sd.premium : supplier.tier === 'verified' ? sd.verified : sd.standard;
  const tierColor = TIER_COLORS[supplier.tier];
  const initials = supplier.company_name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={dir}>
      <Header />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 md:px-6 py-6 pb-24 md:pb-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-5">
          <Link href="/" className="hover:text-foreground transition-colors">{sd.home}</Link>
          <Icon name="ChevronRightIcon" size={12} />
          <Link href="/suppliers" className="hover:text-foreground transition-colors">{sd.suppliers}</Link>
          <Icon name="ChevronRightIcon" size={12} />
          <span className="text-foreground font-medium truncate">{supplier.company_name}</span>
        </div>

        {/* Profile Card */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shrink-0">
              {supplier.logo_url ? (
                <img src={supplier.logo_url} alt={supplier.company_name} className="w-full h-full object-cover rounded-xl" />
              ) : initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-extrabold text-foreground">{supplier.company_name}</h1>
                {supplier.is_verified && (
                  <Icon name="CheckBadgeIcon" size={20} className="text-blue-500 shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${tierColor}`}>{tierLabel}</span>
                <span className="text-xs text-muted-foreground">{supplier.city}, {supplier.country}</span>
              </div>
              {supplier.established_year && (
                <div className="mt-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                      <path fillRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 0 0-.584.859 6.753 6.753 0 0 0 6.138 5.6 6.73 6.73 0 0 0 2.743 1.346A6.707 6.707 0 0 1 9.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a2.25 2.25 0 0 0-2.25 2.25c0 .414.336.75.75.75h15a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-2.25-2.25h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.706 6.706 0 0 1-1.112-3.173 6.73 6.73 0 0 0 2.743-1.347 6.753 6.753 0 0 0 6.139-5.6.75.75 0 0 0-.585-.858 47.077 47.077 0 0 0-3.07-.543V2.62a.75.75 0 0 0-.658-.744 49.798 49.798 0 0 0-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 0 0-.657.744Zm0 2.629c0 1.196.312 2.32.857 3.294A5.266 5.266 0 0 1 3.16 5.337a45.6 45.6 0 0 1 2.006-.343v.256Zm13.5 0v-.256c.674.1 1.343.214 2.006.343a5.265 5.265 0 0 1-2.863 3.207 6.72 6.72 0 0 0 .857-3.294Z" clipRule="evenodd" />
                    </svg>
                    {new Date().getFullYear() - supplier.established_year > 0
                      ? sd.experienceYears.replace('{years}', String(new Date().getFullYear() - supplier.established_year))
                      : sd.sinceYear.replace('{year}', String(supplier.established_year))}
                  </span>
                </div>
              )}
              {supplier.description && (
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  {maskContactInfo(supplier.description)}
                </p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-border">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Icon name="StarIcon" size={14} className="text-amber-400" variant="solid" />
                <span className="text-lg font-extrabold text-foreground">{supplier.rating.toFixed(1)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{supplier.review_count} {sd.reviews}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-extrabold text-foreground">{supplier.response_rate}%</p>
              <p className="text-xs text-muted-foreground mt-0.5">{sd.responseRate}</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-extrabold text-foreground">{supplier.avg_response_time}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{sd.avgReplyTime}</p>
            </div>
          </div>

          {/* Certifications */}
          {supplier.certifications?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {supplier.certifications.map((cert) => (
                <span key={cert} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-md">
                  {cert}
                </span>
              ))}
            </div>
          )}

          {/* Categories */}
          {supplier.main_categories?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {supplier.main_categories.map((cat) => (
                <span key={cat} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-md">{cat}</span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-5">
            <Link
              href={`/rfq/new?supplier=${supplier.user_id}`}
              className="flex-1 text-center py-3 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity"
            >
              Send RFQ
            </Link>
            <Link
              href={`/chat/${supplier.user_id}`}
              className="flex-1 text-center py-3 border border-border text-foreground text-sm font-semibold rounded-xl hover:bg-muted transition-colors"
            >
              Message
            </Link>
          </div>
        </div>

        {/* Reviews Section */}
        <SupplierReviews supplierId={supplier.id} supplierName={supplier.company_name} />
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
