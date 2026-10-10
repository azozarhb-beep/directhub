import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net';

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/categories`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/search`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/suppliers`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/rfq-board`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/factory/register`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ];

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch active products
    const { data: products } = await supabase
      .from('manufacturer_products')
      .select('id, created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(500);

    const productRoutes: MetadataRoute.Sitemap = (products || []).map((p: any) => ({
      url: `${baseUrl}/product/${p.id}`,
      lastModified: new Date(p.created_at),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));

    // Fetch seller profiles
    const { data: sellers } = await supabase
      .from('user_profiles')
      .select('id, created_at')
      .in('role', ['manufacturer', 'supplier', 'factory'])
      .limit(500);

    const sellerRoutes: MetadataRoute.Sitemap = (sellers || []).map((s: any) => ({
      url: `${baseUrl}/seller/${s.id}`,
      lastModified: new Date(s.created_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

    return [...staticRoutes, ...productRoutes, ...sellerRoutes];
  } catch {
    return staticRoutes;
  }
}