'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import type { EditableAgentProduct } from './AgentProductEditDrawer';

export function getAgentProductUrl(productId: string): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net';
  return `${site.replace(/\/$/, '')}/product/${productId}`;
}

export async function copyAgentProductLink(productId: string, successMsg: string, errorMsg: string) {
  const url = getAgentProductUrl(productId);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    toast.success(successMsg);
  } catch {
    toast.error(errorMsg);
  }
}

interface ShareModalProps {
  product: EditableAgentProduct;
  factoryName?: string;
  onClose: () => void;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

export function AgentProductShareModal({ product, factoryName, onClose }: ShareModalProps) {
  const { t, dir } = useLanguage();
  const pa = t.agentProductActions;
  const url = getAgentProductUrl(product.id);
  const [qr, setQr] = useState('');
  const [downloading, setDownloading] = useState(false);
  const image = (product.images || []).filter(Boolean)[0] || '';
  const price = `${product.wholesale_price ?? product.price} ${product.currency}`;
  const moq = `${product.moq} ${product.unit}`;

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, { width: 480, margin: 1, errorCorrectionLevel: 'M' })
      .then(d => { if (active) setQr(d); })
      .catch(() => { if (active) setQr(''); });
    return () => { active = false; };
  }, [url]);

  const handleWhatsApp = () => {
    const msg = [
      pa.shareWaIntro,
      '',
      `📦 ${product.name_ar}${product.name_en ? ` | ${product.name_en}` : ''}`,
      factoryName ? `🏭 ${pa.shareFactory}: ${factoryName}` : '',
      `💰 ${pa.wholesalePrice.replace('*', '').trim()}: ${price}`,
      `📏 ${pa.moq.replace('*', '').trim()}: ${moq}`,
      '',
      `🔗 ${url}`,
    ].filter((l, i, arr) => l !== '' || (i > 0 && arr[i - 1] !== '')).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  const handleDownload = async () => {
    if (!qr) return;
    setDownloading(true);
    try {
      const W = 800;
      const H = 1180;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no ctx');
      const rtl = dir === 'rtl';
      const font = 'Tahoma, Arial, sans-serif';

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, W, 90);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 34px ${font}`;
      ctx.textAlign = 'center';
      ctx.direction = rtl ? 'rtl' : 'ltr';
      ctx.fillText('Direct Hub', W / 2, 58);

      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(60, 120, W - 120, 380);
      const img = image ? await loadImage(image) : null;
      if (img) {
        const scale = Math.min((W - 160) / img.width, 340 / img.height);
        const iw = img.width * scale;
        const ih = img.height * scale;
        ctx.drawImage(img, (W - iw) / 2, 120 + (380 - ih) / 2, iw, ih);
      }

      ctx.fillStyle = '#0f172a';
      ctx.font = `bold 38px ${font}`;
      ctx.textAlign = 'center';
      let y = 560;
      wrapText(ctx, product.name_ar, W - 120, 2).forEach(l => { ctx.fillText(l, W / 2, y); y += 50; });
      if (product.name_en) {
        ctx.fillStyle = '#475569';
        ctx.font = `28px ${font}`;
        ctx.direction = 'ltr';
        wrapText(ctx, product.name_en, W - 120, 2).forEach(l => { ctx.fillText(l, W / 2, y); y += 38; });
        ctx.direction = rtl ? 'rtl' : 'ltr';
      }
      if (factoryName) {
        ctx.fillStyle = '#64748b';
        ctx.font = `26px ${font}`;
        ctx.fillText(`🏭 ${factoryName}`, W / 2, y + 12);
        y += 50;
      }

      const boxY = Math.max(y + 10, 720);
      const boxW = (W - 160) / 2;
      [[pa.wholesalePrice.replace('*', '').trim(), price], [pa.moq.replace('*', '').trim(), moq]].forEach(([label, val], i) => {
        const x = 60 + i * (boxW + 40);
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(x, boxY, boxW, 100);
        ctx.fillStyle = '#64748b';
        ctx.font = `22px ${font}`;
        ctx.fillText(label, x + boxW / 2, boxY + 36);
        ctx.fillStyle = '#0f172a';
        ctx.font = `bold 28px ${font}`;
        ctx.fillText(val, x + boxW / 2, boxY + 76);
      });

      const qrImg = await loadImage(qr);
      const qrY = boxY + 130;
      if (qrImg) ctx.drawImage(qrImg, (W - 260) / 2, qrY, 260, 260);
      ctx.fillStyle = '#475569';
      ctx.font = `22px ${font}`;
      ctx.fillText(pa.shareScanHint, W / 2, qrY + 292);
      ctx.fillStyle = '#2563eb';
      ctx.font = `20px ${font}`;
      ctx.direction = 'ltr';
      ctx.fillText(url, W / 2, qrY + 326);

      const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('blob');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `product-${product.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast.success(pa.shareDownloaded);
    } catch {
      toast.error(pa.shareDownloadFailed);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" dir={dir} role="dialog" aria-modal="true">
      <button type="button" aria-label={pa.close} onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto bg-card border border-border rounded-2xl shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-2">
            <Icon name="QrCodeIcon" size={18} className="text-primary" />
            <h2 className="font-bold text-foreground text-base">{pa.shareTitle}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={pa.close} className="p-1.5 rounded-lg hover:bg-muted">
            <Icon name="XMarkIcon" size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-white border border-border rounded-xl p-4 text-center space-y-3">
            <div className="w-full h-44 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt={product.name_ar} className="w-full h-full object-contain" />
              ) : (
                <Icon name="PhotoIcon" size={40} className="text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="font-bold text-slate-900 text-base">{product.name_ar}</p>
              {product.name_en && <p className="text-sm text-slate-500" dir="ltr">{product.name_en}</p>}
              {factoryName && (
                <p className="text-xs text-slate-500 mt-1 flex items-center justify-center gap-1">
                  <Icon name="BuildingOffice2Icon" size={12} />
                  {pa.shareFactory}: {factoryName}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-100 rounded-lg p-2">
                <p className="text-[11px] text-slate-500">{pa.wholesalePrice.replace('*', '').trim()}</p>
                <p className="text-sm font-bold text-slate-900">{price}</p>
              </div>
              <div className="bg-slate-100 rounded-lg p-2">
                <p className="text-[11px] text-slate-500">{pa.moq.replace('*', '').trim()}</p>
                <p className="text-sm font-bold text-slate-900">{moq}</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt={pa.shareQrAlt} className="w-40 h-40" />
              ) : (
                <div className="w-40 h-40 flex items-center justify-center">
                  <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              <p className="text-[11px] text-slate-500">{pa.shareScanHint}</p>
              <p className="text-[10px] text-blue-600 break-all" dir="ltr">{url}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 px-4 py-3 border-t border-border">
          <button
            type="button"
            onClick={handleWhatsApp}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#25D366] text-white rounded-xl text-sm font-semibold hover:opacity-90"
          >
            <Icon name="ChatBubbleLeftRightIcon" size={16} />
            {pa.shareWhatsApp}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading || !qr}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60"
          >
            {downloading ? (
              <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <Icon name="ArrowDownTrayIcon" size={16} />
            )}
            {pa.shareDownload}
          </button>
        </div>
      </div>
    </div>
  );
}
