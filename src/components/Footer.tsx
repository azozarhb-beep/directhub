'use client';

import React from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { getPlatformName } from '@/lib/i18n';

const Footer: React.FC = () => {
  const { t, isRTL, language } = useLanguage();
  const platformName = getPlatformName(language);

  const infoLinks = [
    { label: t.footer.aboutUs, href: '/about' },
    { label: t.footer.whyDirectHub, href: '/about#why' },
    { label: t.footer.ourVision, href: '/about#vision' },
    { label: t.footer.buyerBenefits, href: '/about#buyers' },
    { label: t.footer.factoryPartnership, href: '/about#factories' },
    { label: t.footer.secureBuyingJourney, href: '/about#journey' },
  ];

  return (
    <footer className="border-t border-border bg-card pb-24 md:pb-0" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-12">

        {/* Info links row */}
        <div className="mb-8 pb-8 border-b border-border">
          <p className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-wide">{t.footer.platformInfo}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {infoLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Single row layout */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          {/* Logo + tagline */}
          <div className="flex items-center gap-3">
            <AppLogo size={32} />
            <div>
              <span className="font-bold text-sm text-foreground" translate="no" lang={isRTL ? 'ar' : 'en'}>{platformName}</span>
            </div>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap gap-x-8 gap-y-3" aria-label="Footer navigation">
            {[
              { label: t.footer.categories, href: '/categories' },
              { label: t.footer.suppliers, href: '/suppliers' },
              { label: t.footer.myAccount, href: '/my-account' },
              { label: t.footer.rfqBoard, href: '/rfq-board' },
              { label: t.footer.factoryProducts, href: '/factory/products' },
            ].map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Social + copyright */}
          <div className="flex flex-col items-start md:items-end gap-3">
            <div className="flex items-center gap-3">
              {[
                { icon: 'GlobeAltIcon', label: 'Website' },
                { icon: 'ChatBubbleLeftEllipsisIcon', label: 'Twitter' },
                { icon: 'BuildingOffice2Icon', label: 'LinkedIn' },
              ].map((s) => (
                <button
                  key={s.label}
                  aria-label={s.label}
                  className="w-9 h-9 border border-border rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                  <Icon name={s.icon as Parameters<typeof Icon>[0]['name']} size={16} />
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              © 2026 <span translate="no" lang={isRTL ? 'ar' : 'en'}>{platformName}</span>, Inc. · {t.footer.allRightsReserved} ·{' '}
              <Link href="/" className="hover:text-foreground transition-colors">{t.footer.privacyPolicy}</Link>{' '}
              · <Link href="/" className="hover:text-foreground transition-colors">{t.footer.termsOfService}</Link>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;