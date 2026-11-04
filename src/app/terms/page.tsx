'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

export default function TermsPage() {
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
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-bold mb-3 border border-orange-500/20">
            <Icon name="DocumentTextIcon" size={14} />
            وثيقة تعاقدية ملزمة
          </div>
          <h1 className="text-2xl sm:text-3xl font-black mb-2 text-foreground">
            شروط الاستخدام والضمان التجاري (B2B Terms)
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            تحدد هذه الاتفاقية القواعد المنظمة للتعاملات التجارية، وعقود التوريد، وحسابات الضمان المشروط (Escrow) بين المصانع والموردين والمشترين عبر منصة دايركت هب (DirectHub).
          </p>
          <p className="text-[11px] text-muted-foreground/75 mt-3">
            DirectHub Technologies Inc. 2026 جميع الحقوق محفوظة.
          </p>
        </div>

        {/* بنود الاتفاقية */}
        <div className="space-y-6">
          {/* البند 1 */}
          <section className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm">
            <h2 className="text-base sm:text-lg font-bold mb-3 text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-orange-500 text-white text-xs font-black flex items-center justify-center">1</span>
              الأهلية والتعامل التجاري الصناعي
            </h2>
            <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed space-y-2">
              <p>• تُخصص منصة دايركت هب للتعاملات التجارية بالجملة (B2B)، طلبات التوريد الصناعي، والمنتجات الجاهزة للشحن.</p>
              <p>• يقر المستخدم (سواء كان مشترياً، مصنعاً، أو مورد خامات) بامتلاكه الأهلية القانونية والسجل التجاري أو التراخيص النظامية للتعاقد وإبرام الصفقات.</p>
            </div>
          </section>

          {/* البند 2 */}
          <section className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm">
            <h2 className="text-base sm:text-lg font-bold mb-3 text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white text-xs font-black flex items-center justify-center">2</span>
              حساب الضمان المشروط (Escrow Protection)
            </h2>
            <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed space-y-2">
              <p>• لحماية أموال المشتري ومستحقات المصنع، يتم إيداع قيمة الصفقات في حساب ضمان مصرفي مشروط.</p>
              <p>• لا يتم تحويل المستحقات للمصنع أو المورد إلا بعد إصدار بوليصة الشحن الرسمية، أو اعتماد تقرير فحص ومطابقة العينات والمواصفات المتفق عليها في العقد.</p>
            </div>
          </section>

          {/* البند 3 */}
          <section className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm">
            <h2 className="text-base sm:text-lg font-bold mb-3 text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-600 text-white text-xs font-black flex items-center justify-center">3</span>
              المواصفات الفنية والفحص قبل الشحن
            </h2>
            <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed space-y-2">
              <p>• يلتزم المصنع التزاماً تاماً بالمواصفات الفنية، القياسات، ومعايير الجودة المحددة في طلب عرض السعر (RFQ) أو الفاتورة الأولية.</p>
              <p>• يحق للمشتري تعيين جهة فحص مستقلة (Inspection Agent) أو استلام عينات معتمدة قبل تحميل الحاويات والشحن النهائي.</p>
            </div>
          </section>

          {/* البند 4 */}
          <section className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-sm">
            <h2 className="text-base sm:text-lg font-bold mb-3 text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-500 text-white text-xs font-black flex items-center justify-center">4</span>
              تسوية النزاعات والتحكيم التجاري
            </h2>
            <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed space-y-2">
              <p>• في حال حدوث أي خلاف متعلق بالتأخير، نقص الكميات، أو عدم مطابقة الجودة، يتم تصعيد الطلب فوراً إلى لجنة التحكيم بالمنصة.</p>
              <p>• تفصل لجنة التحكيم في النزاع خلال مدة أقصاها 48 ساعة بموجب الفواتير وبوالص الشحن وشهادات الفحص، وتعتبر قراراتها ملزمة بحجز المبالغ أو تعويض الطرف المتضرر.</p>
            </div>
          </section>
        </div>

        {/* الإجراءات */}
        <div className="mt-8 pt-6 border-t border-border flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/rfq/create"
            className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-all shadow-md"
          >
            بدء طلب عرض سعر معتمد (RFQ)
          </Link>
          <Link
            href="/disputes"
            className="px-5 py-2.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl transition-colors"
          >
            مركز تسوية النزاعات
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
