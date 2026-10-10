import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const acceptLanguage = request.headers.get('accept-language') || '';
  const isArabic = acceptLanguage.toLowerCase().startsWith('ar') ||
    acceptLanguage.toLowerCase().includes(',ar') ||
    acceptLanguage.toLowerCase().includes(';ar') ||
    /\bar\b/.test(acceptLanguage.toLowerCase());

  const name = isArabic ? 'دايركت هب' : 'Direct Hub';
  const shortName = isArabic ? 'دايركت هب' : 'Direct Hub';
  const lang = isArabic ? 'ar' : 'en';
  const dir = isArabic ? 'rtl' : 'ltr';

  const manifest = {
    id: '/',
    name,
    short_name: shortName,
    description: isArabic
      ? 'منصة B2B للتواصل المباشر بين المصانع والمشترين' :'B2B Marketplace — Direct connection between factories and buyers',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui', 'browser'],
    background_color: '#FFFFFF',
    theme_color: '#FFFFFF',
    orientation: 'portrait-primary',
    lang,
    dir,
    prefer_related_applications: false,
    icons: [
      {
        src: '/assets/directhub-icon-official.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/api/icons/192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/api/icons/192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/api/icons/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/api/icons/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    categories: ['business', 'shopping'],
    shortcuts: [
      {
        name: isArabic ? 'لوحة التحكم' : 'Dashboard',
        short_name: isArabic ? 'لوحتي' : 'Dashboard',
        description: isArabic ? 'افتح لوحة التحكم الخاصة بك' : 'Open your dashboard',
        url: '/buyer-dashboard?source=pwa-shortcut',
        icons: [{ src: '/api/icons/192', sizes: '192x192' }],
      },
      {
        name: isArabic ? 'طلبات الشراء' : 'RFQ Board',
        short_name: 'RFQ',
        description: isArabic ? 'استعرض طلبات الشراء' : 'Browse RFQ board',
        url: '/rfq-board?source=pwa-shortcut',
        icons: [{ src: '/api/icons/192', sizes: '192x192' }],
      },
    ],
    screenshots: [],
  };

  return new NextResponse(JSON.stringify(manifest, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Vary: 'Accept-Language',
    },
  });
}
