import React from 'react';
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { dirForLanguage, isSupportedLanguage, type Language } from '@/lib/i18n';
import '../styles/tailwind.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { WishlistProvider } from '@/contexts/WishlistContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { SourcingFilterProvider } from '@/contexts/SourcingFilterContext';
import NavigationProgress from '@/components/NavigationProgress';
import PWAInstallBanner from '@/components/PWAInstallBanner';
import VisitorTracker from '@/components/VisitorTracker';
import ToasterProvider from '@/components/ToasterProvider';
import AssistantsLoader from '@/components/AssistantsLoader';
import PushSubscriptionManager from '@/components/PushSubscriptionManager';
import ChunkErrorRecovery from '@/components/ChunkErrorRecovery';

// cache-bust: 20261013-v3

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'DirectHub — B2B Marketplace for Manufacturers & Buyers',
    template: '%s | DirectHub B2B Marketplace',
  },
  description:
    'Connect directly with verified manufacturers worldwide. Source products across all categories with transparent MOQ pricing and factory-direct rates on DirectHub — the leading B2B marketplace.',
  keywords: [
    'B2B marketplace', 'manufacturers', 'suppliers', 'factory direct', 'wholesale',
    'MOQ', 'sourcing', 'industrial products', 'China suppliers', 'Turkey suppliers',
    'سوق بي تو بي', 'مصانع', 'موردين', 'توريد مباشر', 'DirectHub',
  ],
  authors: [{ name: 'DirectHub', url: siteUrl }],
  creator: 'DirectHub',
  publisher: 'DirectHub',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'DirectHub',
    title: 'DirectHub — B2B Marketplace for Manufacturers & Buyers',
    description: 'Connect directly with verified manufacturers worldwide. Factory-direct sourcing across all product categories.',
    images: [
      {
        url: '/assets/images/app_logo.png',
        width: 1200,
        height: 630,
        alt: 'DirectHub B2B Marketplace — Connect with verified manufacturers worldwide',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DirectHub — B2B Marketplace for Manufacturers & Buyers',
    description: 'Connect directly with verified manufacturers worldwide. Factory-direct sourcing across all product categories.',
    images: ['/assets/images/app_logo.png'],
    creator: '@DirectHub',
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/api/icons/192', sizes: '192x192', type: 'image/png' },
      { url: '/api/icons/512', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/api/icons/192', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/favicon.svg',
  },
  manifest: '/api/manifest',
  alternates: {
    canonical: siteUrl,
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'DirectHub',
  url: siteUrl,
  logo: `${siteUrl}/assets/images/app_logo.png`,
  description: 'B2B marketplace connecting buyers with verified manufacturers and suppliers worldwide.',
  sameAs: [],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    availableLanguage: ['English', 'Arabic'],
  },
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'DirectHub',
  url: siteUrl,
  potentialAction: {
    '@type': 'SearchAction',
    target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl}/search?q={search_term_string}` },
    'query-input': 'required name=search_term_string',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const cookieLang = cookieStore.get('dh_lang')?.value;
  const language: Language = isSupportedLanguage(cookieLang) ? cookieLang : 'en';
  const dir = dirForLanguage(language);

  return (
    <html lang={language} dir={dir} className="font-sans" suppressHydrationWarning>
      <head>
        {/* Re-apply the SAME cookie language the server rendered.
            Do not sniff navigator.language here — that mutates <html> before
            hydration and causes a React attribute mismatch. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|; )dh_lang=([^;]*)/);if(!m){var n=(navigator.language||'en').toLowerCase();var d=n.indexOf('ar')===0?'ar':n.indexOf('zh')===0?'zh':n.indexOf('tr')===0?'tr':'en';document.cookie='dh_lang='+encodeURIComponent(d)+'; Path=/; Max-Age=31536000; SameSite=Lax';return;}var l=decodeURIComponent(m[1]);if(['en','ar','zh','tr'].indexOf(l)<0)return;document.documentElement.lang=l;document.documentElement.dir=l==='ar'?'rtl':'ltr';}catch(e){}})();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var K='dh_early_chunk_reload';function go(){try{var c=Number(sessionStorage.getItem(K)||'0');var now=Date.now();var last=Number(sessionStorage.getItem(K+'_at')||'0');if(now-last>60000)c=0;if(c>=3)return;sessionStorage.setItem(K,String(c+1));sessionStorage.setItem(K+'_at',String(now));setTimeout(function(){try{var u=new URL(window.location.href);u.searchParams.set('_cb',String(Date.now()));window.location.replace(u.toString());}catch(e2){window.location.reload();}},1000+c*1500);}catch(err){}}var RE=/ChunkLoadError|Loading chunk [^\\s]+ failed|Loading CSS chunk|timeout: [^\\s]*\\/_next\\/static\\//i;function bad(v){try{if(!v)return false;if(/app\\/global-error/i.test(String(v.message||v)))return false;return RE.test((v.name||'')+' '+(v.message||String(v)));}catch(e){return false}}window.addEventListener('error',function(e){try{var t=e&&e.target;if(t&&t!==window){var s=t.src||t.href||'';if(/\\/_next\\/static\\/(chunks|css)\\//.test(s)&&!/app\\/global-error/i.test(s))go();return;}if(bad(e.error)||bad(e.message))go();}catch(err){}},true);window.addEventListener('unhandledrejection',function(e){if(bad(e&&e.reason))go();});})();`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />

        <script type="module" async src="https://static.rocket.new/rocket-web.js?_cfg=https%3A%2F%2Fdirecthub3220back.builtwithrocket.new&_be=https%3A%2F%2Fappanalytics.rocket.new&_v=0.1.21" />
        <script type="module" defer src="https://static.rocket.new/rocket-shot.js?v=0.0.3" /></head>
      <body className="font-sans">
        <ChunkErrorRecovery />
        <NavigationProgress />
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <LanguageProvider initialLanguage={language}>
                <SourcingFilterProvider>
                  <ToasterProvider />
                  <VisitorTracker />
                  <PushSubscriptionManager />
                  {children}
                  <PWAInstallBanner />
                  <AssistantsLoader />
                </SourcingFilterProvider>
              </LanguageProvider>
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>

        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) { window.addEventListener('load', function() { navigator.serviceWorker.register('/sw.js').then(function(reg) { reg.update(); }); }); }`,
          }}
        />
      </body>
    </html>
  );
}