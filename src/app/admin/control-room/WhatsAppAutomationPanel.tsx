'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { buildWelcomeWhatsAppLink, isArabicSpeaking,  } from '@/lib/whatsappOrderLinks';

interface UserWithPhone {
  id: string;
  full_name: string;
  company_name: string;
  phone: string;
  country: string;
  role: string;
  created_at: string;
}

function formatDate(d: string): string {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const ADMIN_PRIMARY = '967771577632';
const ADMIN_SECONDARY = '967771572767';

export default function WhatsAppAutomationPanel() {
  const { dir, language } = useLanguage();
  const supabase = createClient();
  const [users, setUsers] = useState<UserWithPhone[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const isAr = language === 'ar';

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('id, full_name, company_name, phone, country, role, created_at')
        .not('phone', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200);
      setUsers(data || []);
    } catch (e) {
      console.error('WhatsApp panel error:', e);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.company_name || '').toLowerCase().includes(q) ||
      (u.phone || '').includes(q)
    );
  });

  return (
    <div className="space-y-5" dir={dir}>
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="ChatBubbleLeftRightIcon" size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">
              {isAr ? 'نظام واتساب — روابط Click-to-Chat' : 'WhatsApp — Click-to-Chat Links'}
            </h2>
            <p className="text-sm text-white/70">
              {isAr
                ? 'روابط wa.me ديناميكية خالصة من جانب العميل — بدون API، بدون رموز، بدون رسوم' :'100% free client-side wa.me links — no API, no tokens, no paid services'}
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <span className="px-3 py-1 bg-white/20 text-white text-xs font-bold rounded-full">
              ✅ {isAr ? 'مجاني 100%' : '100% Free'}
            </span>
            <span className="text-[10px] text-white/70">wa.me</span>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
        <h3 className="font-bold text-emerald-800 mb-3 flex items-center gap-2">
          <Icon name="InformationCircleIcon" size={18} className="text-emerald-600" />
          {isAr ? 'كيف يعمل النظام' : 'How the System Works'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              icon: 'LinkIcon',
              title: isAr ? 'روابط ديناميكية' : 'Dynamic Links',
              desc: isAr
                ? 'كل رابط يُولَّد لحظياً بالاسم والطلب والمنتج' :'Each link is generated on-the-fly with name, order, and product',
              color: 'text-emerald-700',
            },
            {
              icon: 'LanguageIcon',
              title: isAr ? 'متعدد اللغات' : 'Multi-Language',
              desc: isAr
                ? 'عربي للدول العربية، إنجليزي للدول الأجنبية تلقائياً' :'Arabic for Arab countries, English for international — auto-detected',
              color: 'text-blue-700',
            },
            {
              icon: 'GlobeAltIcon',
              title: isAr ? 'دولي' : 'International',
              desc: isAr
                ? 'تحليل أرقام دولية: +86 الصين، +90 تركيا، +967 اليمن...' :'Parses international numbers: +86 China, +90 Turkey, +967 Yemen...',
              color: 'text-purple-700',
            },
          ].map((item) => (
            <div key={item.title} className="bg-white rounded-xl p-3 border border-emerald-100">
              <div className="flex items-center gap-2 mb-1">
                <Icon name={item.icon as any} size={16} className={item.color} />
                <p className="text-sm font-bold text-foreground">{item.title}</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Admin Quick-Contact */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
          <Icon name="ShieldCheckIcon" size={18} className="text-green-600" />
          {isAr ? 'أرقام المدير — اتصال مباشر' : 'Admin Numbers — Direct Contact'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: isAr ? 'المدير الأساسي' : 'Primary Admin', phone: ADMIN_PRIMARY, badge: isAr ? 'أساسي' : 'Primary' },
            { label: isAr ? 'المدير الثانوي' : 'Secondary Admin', phone: ADMIN_SECONDARY, badge: isAr ? 'ثانوي' : 'Secondary' },
          ].map((admin) => {
            const msg = isAr
              ? `مرحباً، أتواصل معك من منصة دايركت هب`
              : `Hello, I'm contacting you from DirectHub platform`;
            const waUrl = `https://api.whatsapp.com/send?phone=${admin.phone}&text=${encodeURIComponent(msg)}`;
            return (
              <div key={admin.phone} className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-green-800">{admin.label}</span>
                  <span className="px-2 py-0.5 bg-green-600 text-white text-[10px] font-bold rounded-full">{admin.badge}</span>
                </div>
                <p className="text-lg font-bold text-green-700 font-mono mb-3">+{admin.phone}</p>
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors w-full justify-center"
                >
                  <Icon name="ChatBubbleLeftRightIcon" size={16} />
                  {isAr ? 'فتح واتساب' : 'Open WhatsApp'}
                </a>
              </div>
            );
          })}
        </div>
      </div>

      {/* Message Templates Reference */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
          <Icon name="DocumentTextIcon" size={18} className="text-blue-600" />
          {isAr ? 'قوالب الرسائل المدمجة' : 'Built-in Message Templates'}
        </h3>
        <div className="space-y-3">
          {[
            {
              event: isAr ? 'ترحيب بالمشتري' : 'Buyer Welcome',
              ar: 'مرحباً بك في أكبر الأسواق العالمية، دايركت هب',
              en: 'Welcome to DirectHub - The Premier Global B2B Marketplace',
              icon: 'HandRaisedIcon',
              color: 'text-blue-600',
            },
            {
              event: isAr ? 'تأكيد الطلب (للمشتري)' : 'Order Placed (Buyer)',
              ar: 'تم استلام طلبك بنجاح في أكبر الأسواق العالمية، دايركت هب',
              en: 'Your order has been successfully placed on DirectHub.',
              icon: 'ShoppingCartIcon',
              color: 'text-purple-600',
            },
            {
              event: isAr ? 'طلب جديد (للمصنع)' : 'New Order (Factory)',
              ar: 'لديك طلب جديد قيد المراجعة في دايركت هب',
              en: 'You have a new order pending review on DirectHub.',
              icon: 'BuildingStorefrontIcon',
              color: 'text-amber-600',
            },
            {
              event: isAr ? 'تأكيد الدفع (للمصنع)' : 'Payment Confirmed (Factory)',
              ar: 'تم الدفع لحساب المنصة، يرجى تجهيز الطلب',
              en: 'Payment has been secured in the platform account. Please prepare the order.',
              icon: 'BanknotesIcon',
              color: 'text-green-600',
            },
            {
              event: isAr ? 'تأكيد الشحن (للمشتري)' : 'Shipping Confirmed (Buyer)',
              ar: 'تم شحن طلبك، شكراً لتعاملك مع دايركت هب',
              en: 'Your order has been shipped. Thank you for doing business with DirectHub.',
              icon: 'TruckIcon',
              color: 'text-indigo-600',
            },
            {
              event: isAr ? 'مشاركة منتج' : 'Product Share',
              ar: 'اكتشف هذا المنتج الحصري وأفضل عروض المصانع العالمية في دايركت هب:',
              en: 'Check out this exclusive product and top global factory offers on DirectHub:',
              icon: 'ShareIcon',
              color: 'text-rose-600',
            },
          ].map((tpl) => (
            <div key={tpl.event} className="bg-muted/30 rounded-xl p-3 border border-border">
              <div className="flex items-center gap-2 mb-2">
                <Icon name={tpl.icon as any} size={14} className={tpl.color} />
                <p className="text-sm font-bold text-foreground">{tpl.event}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="bg-green-50 rounded-lg p-2 border border-green-100">
                  <p className="text-[10px] font-bold text-green-700 mb-1">🇾🇪 عربي</p>
                  <p className="text-xs text-green-800 leading-relaxed" dir="rtl">{tpl.ar}</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-700 mb-1">🌍 English</p>
                  <p className="text-xs text-blue-800 leading-relaxed">{tpl.en}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Users with wa.me links */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <Icon name="UsersIcon" size={18} className="text-green-600" />
            {isAr ? 'المستخدمون — روابط واتساب المباشرة' : 'Users — Direct WhatsApp Links'}
            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full">{users.length}</span>
          </h3>
          <button
            onClick={loadUsers}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-border hover:bg-muted transition-colors"
          >
            {loading
              ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              : <Icon name="ArrowPathIcon" size={13} />}
            {isAr ? 'تحديث' : 'Refresh'}
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Icon name="MagnifyingGlassIcon" size={16} className="absolute top-1/2 -translate-y-1/2 start-3 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={isAr ? 'بحث بالاسم أو الشركة أو الرقم...' : 'Search by name, company, or phone...'}
            className="w-full ps-9 pe-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-green-500/30"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            {isAr ? 'لا توجد نتائج' : 'No results found'}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start py-2 px-3 text-xs font-semibold text-muted-foreground">
                    {isAr ? 'المستخدم' : 'User'}
                  </th>
                  <th className="text-start py-2 px-3 text-xs font-semibold text-muted-foreground hidden sm:table-cell">
                    {isAr ? 'الدور' : 'Role'}
                  </th>
                  <th className="text-start py-2 px-3 text-xs font-semibold text-muted-foreground hidden md:table-cell">
                    {isAr ? 'الرقم' : 'Phone'}
                  </th>
                  <th className="text-start py-2 px-3 text-xs font-semibold text-muted-foreground hidden lg:table-cell">
                    {isAr ? 'التاريخ' : 'Date'}
                  </th>
                  <th className="text-start py-2 px-3 text-xs font-semibold text-muted-foreground">
                    {isAr ? 'واتساب' : 'WhatsApp'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((user) => {
                  const arabic = isArabicSpeaking(user.country, user.phone);
                  const waLink = buildWelcomeWhatsAppLink(user.phone, user.country);
                  const roleLabel = user.role === 'buyer' ? (isAr ?'مشتري' : 'Buyer')
                    : user.role === 'manufacturer' ? (isAr ?'مصنّع' : 'Manufacturer')
                    : (isAr ? 'مسؤول' : 'Admin');
                  return (
                    <tr key={user.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3">
                        <p className="font-semibold text-foreground text-xs">{user.full_name || '—'}</p>
                        {user.company_name && (
                          <p className="text-[10px] text-muted-foreground">{user.company_name}</p>
                        )}
                      </td>
                      <td className="py-2 px-3 hidden sm:table-cell">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                          user.role === 'buyer' ? 'bg-sky-50 text-sky-700 border-sky-200'
                          : user.role === 'manufacturer'? 'bg-purple-50 text-purple-700 border-purple-200' :'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {roleLabel}
                        </span>
                      </td>
                      <td className="py-2 px-3 hidden md:table-cell">
                        <span className="font-mono text-xs text-muted-foreground">{user.phone}</span>
                      </td>
                      <td className="py-2 px-3 hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">{formatDate(user.created_at)}</span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5">
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1 bg-green-600 text-white text-[10px] font-bold rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <Icon name="ChatBubbleLeftRightIcon" size={11} />
                            {isAr ? 'ترحيب' : 'Welcome'}
                          </a>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${arabic ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            {arabic ? 'AR' : 'EN'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length > 100 && (
              <p className="text-center text-xs text-muted-foreground mt-3 py-2">
                {isAr ? `عرض أول 100 من ${filtered.length}` : `Showing first 100 of ${filtered.length}`}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
