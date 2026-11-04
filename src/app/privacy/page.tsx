'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

export default function PrivacyPage() {
  const { isRTL } = useLanguage();

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 md:pb-12" dir={isRTL ? 'rtl' : 'ltr'}>
      <Header />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        {/* زر العودة */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
          >
            <Icon name="ArrowRightIcon" size={14} className={isRTL ? '' : 'rotate-180'} />
            العودة للرئيسية
          </Link>
        </div>

        {/* ترويسة الصفحة */}
        <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 mb-8 shadow-sm">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold mb-3 border border-emerald-500/20">
            <Icon name="ShieldCheckIcon" size={14} />
            حماية وأمان البيانات التجارية
          </div>
          <h1 className="text-2xl sm:text-3xl font-black mb-2 text-foreground">
            سياسة الخصوصية وحماية بيانات B2B
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            تلتزم منصة دايركت هب (DirectHub) بحماية سرية البيانات التعاقدية، وعروض الأسعار الصناعية، وسجلات الشحن والتحويلات المالية بين المصانع والمشترين.
          </p>
          <p className="text-[11px] text-muted-foreground/75 mt-3">
            DirectHub Technologies Inc. 2026 جميع الحقوق محفوظة.
          </p>
        </div>

        {/* البنود */}
        <div className="space-y-6">
          <section className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm">
            <h2 className="text-base sm:text-lg font-bold mb-3 text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white text-xs font-black flex items-center justify-center">1</span>
              سرية عروض الأسعار والطلبيات (RFQ Confidentiality)
            </h2>
            <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed space-y-2">
              <p>• تُعامل مواصفات المنتجات والتصميمات الخاصة بطلبات الأسعار (RFQ) بسرية تامة ولا تتم مشاركتها إلا مع المصانع المعتمدة والمؤهلة للتصنيع.</p>
              <p>• لا يتم إفشاء الأسعار التعاقدية أو الخصومات الحجمية لأطراف خارجية منافسة.</p>
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm">
            <h2 className="text-base sm:text-lg font-bold mb-3 text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-600 text-white text-xs font-black flex items-center justify-center">2</span>
              حماية المعاملات المصرفية وبيانات الدفع
            </h2>
            <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed space-y-2">
              <p>• جميع التحويلات وتفاصيل حسابات الضمان المشروط (Escrow) مشفرة وفق أعلى معايير الأمان المالي المصرفي.</p>
              <p>• لا تقوم المنصة بتخزين أرقام البطاقات المصرفية أو تفاصيل الحسابات الحساسة في خوادم مكشوفة.</p>
            </div>
          </section>

          <section className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm">
            <h2 className="text-base sm:text-lg font-bold mb-3 text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-orange-500 text-white text-xs font-black flex items-center justify-center">3</span>
              المحادثات والوثائق اللوجستية الموثقة
            </h2>
            <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed space-y-2">
              <p>• سجلات المراسلات بين المشتري والمصنع، وبوالص الشحن، وشهادات الفحص تُحفظ كوثائق رسمية للرجوع إليها في حال حدوث أي نزاع تجاري لحفظ حقوق الطرفين.</p>
            </div>
          </section>
        </div>

        {/* الإجراءات */}
        <div className="mt-8 pt-6 border-t border-border flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/terms"
            className="px-5 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl transition-colors"
          >
            الاطلاع على شروط الاستخدام
          </Link>
          <Link
            href="/rfq/create"
            className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-all shadow-md"
          >
            بدء طلب توريد محمي (RFQ)
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
