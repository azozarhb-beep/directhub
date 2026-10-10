import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search Products & Manufacturers — DirectHub',
  description: 'Search thousands of B2B products and verified manufacturers on DirectHub. Filter by category, country, certifications, price, MOQ, and delivery time.',
  keywords: ['search products', 'find manufacturers', 'B2B search', 'wholesale products', 'factory search', 'supplier search'],
  alternates: { canonical: '/search' },
  openGraph: {
    title: 'Search Products & Manufacturers — DirectHub',
    description: 'Search thousands of B2B products and verified manufacturers. Filter by category, country, certifications, and more.',
    images: [{ url: '/assets/images/app_logo.png', width: 1200, height: 630, alt: 'DirectHub Product Search' }],
  },
};
