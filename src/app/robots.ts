import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/_next/',
          '/admin/',
          '/manufacturer/dashboard',
          '/my-account',
          '/orders',
          '/cart',
          '/checkout',
          '/invoices',
          '/notifications',
          '/chat',
          '/order-confirmation',
          '/order-status',
          '/order-tracking',
          '/order-fulfillment',
          '/management',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/', '/_next/', '/admin/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}