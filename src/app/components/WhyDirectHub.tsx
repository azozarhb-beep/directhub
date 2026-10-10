'use client';

import React, { useEffect, useRef, useState } from 'react';

import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

interface PlatformStats {
  verifiedSuppliers: number;
  totalProducts: number;
  totalOrders: number;
}

const WhyDirectHub: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [stats, setStats] = useState<PlatformStats>({ verifiedSuppliers: 0, totalProducts: 0, totalOrders: 0 });
  const supabase = createClient();
  const { language, isRTL, t } = useLanguage();

  const reasons = [
    {
      icon: 'CheckBadgeIcon',
      title: { en: 'Verified Manufacturers', ar: 'مصنّعون موثّقون', zh: '认证制造商', tr: 'Doğrulanmış Üreticiler' },
      desc: { en: 'Every supplier is audited by our team. Factory visits, business license verification, and quality certifications checked before listing.', ar: 'كل مورّد يخضع لتدقيق فريقنا. زيارات ميدانية للمصانع والتحقق من الرخص التجارية وشهادات الجودة قبل الإدراج.', zh: '每位供应商均经过我们团队的审核，包括工厂实地考察、营业执照核查及质量认证审查。', tr: 'Her tedarikçi ekibimiz tarafından denetlenir. Fabrika ziyaretleri, ticaret lisansı doğrulaması ve kalite sertifikaları listelenmeden önce kontrol edilir.' },
    },
    {
      icon: 'CurrencyDollarIcon',
      title: { en: 'Factory-Direct Pricing', ar: 'أسعار مباشرة من المصنع', zh: '工厂直供价格', tr: 'Fabrikadan Doğrudan Fiyat' },
      desc: { en: 'No middlemen, no hidden markups. Connect directly with the source for the lowest possible wholesale prices.', ar: 'لا وسطاء، لا رسوم خفية. تواصل مباشرة مع المصدر للحصول على أدنى أسعار الجملة الممكنة.', zh: '无中间商，无隐性加价。直接与源头联系，获取最低批发价格。', tr: 'Aracı yok, gizli fiyat artışı yok. En düşük toptan fiyatlar için doğrudan kaynakla bağlantı kurun.' },
    },
    {
      icon: 'ShieldCheckIcon',
      title: { en: 'Trade Assurance', ar: 'ضمان التجارة', zh: '贸易保障', tr: 'Ticaret Güvencesi' },
      desc: { en: 'Full payment protection until your order is confirmed delivered. Dispute resolution within 72 hours.', ar: 'حماية كاملة للدفع حتى تأكيد استلام طلبك. حل النزاعات خلال 72 ساعة.', zh: '订单确认交付前提供全额付款保护，72小时内解决争议。', tr: 'Siparişiniz teslim edildiği onaylanana kadar tam ödeme koruması. 72 saat içinde anlaşmazlık çözümü.' },
    },
  ];

  const getLabel = (obj: Record<string, string>) => obj[language] || obj.en;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [suppliersRes, productsRes, ordersRes] = await Promise.all([
          supabase.from('supplier_profiles').select('id', { count: 'exact', head: true }).eq('is_verified', true),
          supabase.from('manufacturer_products').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('orders').select('id', { count: 'exact', head: true }),
        ]);
        setStats({
          verifiedSuppliers: suppliersRes.count || 0,
          totalProducts: productsRes.count || 0,
          totalOrders: ordersRes.count || 0,
        });
      } catch {
        // keep zeros
      }
    };
    fetchStats();
  }, []);

  const statCards = [
    { value: String(stats.verifiedSuppliers || '50K+'), label: { en: 'Verified Suppliers', ar: 'مورّد موثّق', zh: '认证供应商', tr: 'Doğrulanmış Tedarikçi' }, icon: 'CheckBadgeIcon' },
    { value: String(stats.totalProducts || '200K+'), label: { en: 'Active Products', ar: 'منتج نشط', zh: '活跃产品', tr: 'Aktif Ürün' }, icon: 'ArchiveBoxIcon' },
    { value: String(stats.totalOrders || '10K+'), label: { en: 'Total Orders', ar: 'إجمالي الطلبات', zh: '总订单数', tr: 'Toplam Sipariş' }, icon: 'ShoppingBagIcon' },
    { value: 'B2B', label: { en: 'Global Platform', ar: 'منصة عالمية', zh: '全球平台', tr: 'Küresel Platform' }, icon: 'GlobeAltIcon' },
  ];

  const sectionTitle = { en: 'Why DirectHub?', ar: 'لماذا دايركت هب؟', zh: '为什么选择DirectHub？', tr: 'Neden DirectHub?' };
  const sectionSubtitle = { en: 'The trusted B2B marketplace for industrial sourcing', ar: 'السوق الموثوق للتوريد الصناعي B2B', zh: '值得信赖的工业采购B2B平台', tr: 'Endüstriyel tedarik için güvenilir B2B pazaryeri' };

  return (
    <section suppressHydrationWarning className="bg-background py-16 border-b border-border/20" ref={sectionRef} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Section label */}
        <div className={`text-center mb-12 transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}>
          <p className="text-primary text-xs font-bold uppercase tracking-widest mb-2">{getLabel(sectionTitle)}</p>
          <h2 className="text-2xl md:text-3xl font-extrabold text-foreground">{getLabel(sectionSubtitle)}</h2>
        </div>

        {/* Reason cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {reasons.map((reason, idx) => (
            <div
              key={idx}
              className={`bg-foreground/5 border border-foreground/10 rounded-2xl p-6 transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}
              style={{ transitionDelay: `${idx * 100}ms` }}
            >
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center mb-4">
                <Icon name={reason.icon as any} size={20} className="text-primary" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-2">{getLabel(reason.title)}</h3>
              <p className="text-foreground/60 text-sm leading-relaxed">{getLabel(reason.desc)}</p>
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map((stat, idx) => (
            <div
              key={idx}
              className={`text-center bg-foreground/5 border border-foreground/10 rounded-xl p-4 transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}
              style={{ transitionDelay: `${idx * 75}ms` }}
            >
              <Icon name={stat.icon as any} size={20} className="text-primary mx-auto mb-2" />
              <p className="text-2xl font-extrabold text-foreground">{stat.value}</p>
              <p className="text-foreground/60 text-xs mt-1">{getLabel(stat.label)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyDirectHub;