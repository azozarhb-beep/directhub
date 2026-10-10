import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Browse Suppliers & Manufacturers — DirectHub',
  description: 'Find verified manufacturers and suppliers on DirectHub. Filter by country, category, certifications, and response rate. Connect with trusted B2B partners worldwide.',
  keywords: ['suppliers', 'manufacturers', 'verified suppliers', 'B2B partners', 'factory directory', 'wholesale suppliers'],
  alternates: { canonical: '/suppliers' },
  openGraph: {
    title: 'Browse Suppliers & Manufacturers — DirectHub',
    description: 'Find verified manufacturers and suppliers on DirectHub. Filter by country, category, and certifications.',
    images: [{ url: '/assets/images/app_logo.png', width: 1200, height: 630, alt: 'DirectHub Suppliers Directory' }],
  },
};
