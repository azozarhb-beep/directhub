import { NextRequest, NextResponse } from 'next/server';

// Inline SVG for DH Monogram icon — orange gradient background, white D+H, gold accents
const DH_SVG = (size: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <defs>
    <linearGradient id="orangeBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FB923C"/>
      <stop offset="100%" style="stop-color:#EA6C00"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" ry="96" fill="url(#orangeBg)"/>
  <rect width="512" height="200" rx="96" ry="96" fill="#ffffff" opacity="0.06"/>
  <rect x="110" y="140" width="26" height="232" rx="6" fill="#FFFFFF"/>
  <path d="M 136 140 Q 290 140 290 256 Q 290 372 136 372" stroke="#FFFFFF" stroke-width="26" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="308" y="165" width="4" height="182" rx="2" fill="#FFD700" opacity="0.9"/>
  <rect x="326" y="140" width="26" height="232" rx="6" fill="#FFFFFF"/>
  <rect x="400" y="140" width="26" height="232" rx="6" fill="#FFFFFF"/>
  <rect x="326" y="243" width="100" height="26" rx="6" fill="#FFFFFF"/>
  <rect x="326" y="243" width="100" height="5" rx="2.5" fill="#FFD700"/>
  <circle cx="326" cy="256" r="6" fill="#FFD700"/>
  <circle cx="426" cy="256" r="6" fill="#FFD700"/>
  <rect x="110" y="400" width="292" height="5" rx="2.5" fill="#FFD700" opacity="0.75"/>
</svg>`;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size: sizeParam } = await params; // e.g. "192" or "512"
  const size = sizeParam === '512' ? 512 : 192;

  const svg = DH_SVG(size);

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
