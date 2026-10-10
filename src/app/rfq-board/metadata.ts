import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RFQ Board — Post & Browse Requests for Quotation | DirectHub',
  description: 'Post your Request for Quotation (RFQ) on DirectHub and receive competitive offers from verified manufacturers worldwide. Browse active RFQs across all product categories.',
  keywords: ['RFQ', 'request for quotation', 'B2B sourcing', 'wholesale quotes', 'manufacturer quotes', 'procurement'],
  alternates: { canonical: '/rfq-board' },
  openGraph: {
    title: 'RFQ Board — Post & Browse Requests for Quotation | DirectHub',
    description: 'Post your RFQ and receive competitive offers from verified manufacturers worldwide.',
    images: [{ url: '/assets/images/app_logo.png', width: 1200, height: 630, alt: 'DirectHub RFQ Board' }],
  },
};
