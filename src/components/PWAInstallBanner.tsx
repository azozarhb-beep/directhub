'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Language } from '@/lib/i18n';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type BrowserType =
  | 'chrome-android' | 'ios-safari' | 'ios-chrome' | 'ios-firefox' |'firefox-android' | 'samsung' | 'opera-android' | 'edge-android' | 'unknown';

type BannerCopy = {
  title: string;
  subtitle: string;
  install: string;
  close: string;
  howTo: string;
  hideSteps: string;
  iosShareHint: string;
  alt: string;
};

const BANNER_COPY: Record<Language, BannerCopy> = {
  en: {
    title: 'Install Direct Hub Markets',
    subtitle: 'Quick access without the app store — works offline',
    install: 'Install app now',
    close: 'Close',
    howTo: 'How do I add the app to my home screen?',
    hideSteps: 'Hide instructions',
    iosShareHint: 'Look for the Share icon ↑ in the Safari bottom bar',
    alt: 'Direct Hub Markets',
  },
  ar: {
    title: 'ثبّت تطبيق أسواق دايركت هب',
    subtitle: 'وصول سريع بدون متجر التطبيقات — يعمل بدون إنترنت',
    install: 'تثبيت التطبيق الآن',
    close: 'إغلاق',
    howTo: 'كيف أضيف التطبيق إلى شاشتي؟',
    hideSteps: 'إخفاء التعليمات',
    iosShareHint: 'ابحث عن أيقونة المشاركة ↑ في شريط Safari السفلي',
    alt: 'أسواق دايركت هب',
  },
  zh: {
    title: '安装 Direct Hub Markets',
    subtitle: '无需应用商店即可快速访问 — 支持离线使用',
    install: '立即安装应用',
    close: '关闭',
    howTo: '如何将应用添加到主屏幕？',
    hideSteps: '隐藏说明',
    iosShareHint: '在 Safari 底部工具栏查找分享图标 ↑',
    alt: 'Direct Hub Markets',
  },
  tr: {
    title: 'Direct Hub Markets uygulamasını yükle',
    subtitle: 'Uygulama mağazası olmadan hızlı erişim — çevrimdışı çalışır',
    install: 'Uygulamayı şimdi yükle',
    close: 'Kapat',
    howTo: 'Uygulamayı ana ekranıma nasıl eklerim?',
    hideSteps: 'Talimatları gizle',
    iosShareHint: 'Safari alt çubuğundaki Paylaş simgesini ↑ arayın',
    alt: 'Direct Hub Markets',
  },
};

type StepSet = { title: string; steps: { icon: string; text: string }[] };

const BROWSER_STEPS: Record<Language, Record<BrowserType, StepSet | null>> = {
  en: {
    'chrome-android': null,
    'ios-safari': {
      title: 'Add the app to your Home Screen (Safari)',
      steps: [
        { icon: '⬆️', text: 'Tap the Share button in the bottom toolbar' },
        { icon: '📋', text: 'Scroll down and choose “Add to Home Screen”' },
        { icon: '✅', text: 'Tap “Add” in the top-right corner' },
      ],
    },
    'ios-chrome': {
      title: 'Add the app to your Home Screen (Chrome iOS)',
      steps: [
        { icon: '⋯', text: 'Tap the three dots (⋯) at the bottom of the screen' },
        { icon: '📋', text: 'Choose “Add to Home Screen”' },
        { icon: '✅', text: 'Tap “Add” to confirm' },
      ],
    },
    'ios-firefox': {
      title: 'Add the app to your Home Screen (Firefox iOS)',
      steps: [
        { icon: '⋯', text: 'Tap the menu button (⋯) in the bottom bar' },
        { icon: '📋', text: 'Choose “Add to Home Screen”' },
        { icon: '✅', text: 'Tap “Add” to confirm' },
      ],
    },
    'firefox-android': {
      title: 'Add the app to your Home Screen (Firefox)',
      steps: [
        { icon: '⋮', text: 'Tap the three dots (⋮) in the top-right corner' },
        { icon: '📋', text: 'Choose “Install” or “Add to Home Screen”' },
        { icon: '✅', text: 'Tap “Add” to confirm' },
      ],
    },
    samsung: {
      title: 'Add the app to your Home Screen (Samsung Internet)',
      steps: [
        { icon: '☰', text: 'Tap the menu icon (☰) in the bottom bar' },
        { icon: '➕', text: 'Choose “Add page to” then “Home screen”' },
        { icon: '✅', text: 'Tap “Add” to confirm' },
      ],
    },
    'opera-android': {
      title: 'Add the app to your Home Screen (Opera)',
      steps: [
        { icon: '⋮', text: 'Tap the three dots (⋮) in the top-right corner' },
        { icon: '📋', text: 'Choose “Add to Home Screen”' },
        { icon: '✅', text: 'Tap “Add” to confirm' },
      ],
    },
    'edge-android': {
      title: 'Add the app to your Home Screen (Edge)',
      steps: [
        { icon: '⋯', text: 'Tap the three dots (⋯) in the bottom bar' },
        { icon: '📱', text: 'Choose “Add to phone” or “Add to Home Screen”' },
        { icon: '✅', text: 'Tap “Add” to confirm' },
      ],
    },
    unknown: {
      title: 'Add the app to your Home Screen',
      steps: [
        { icon: '⋮', text: 'Open the browser menu (three dots or Share)' },
        { icon: '📋', text: 'Find “Add to Home Screen”' },
        { icon: '✅', text: 'Tap “Add” to confirm' },
      ],
    },
  },
  ar: {
    'chrome-android': null,
    'ios-safari': {
      title: 'أضف التطبيق إلى شاشتك الرئيسية (Safari)',
      steps: [
        { icon: '⬆️', text: 'اضغط على زر المشاركة في شريط الأدوات السفلي' },
        { icon: '📋', text: 'مرّر للأسفل واختر "إضافة إلى الشاشة الرئيسية"' },
        { icon: '✅', text: 'اضغط "إضافة" في الزاوية العلوية اليمنى' },
      ],
    },
    'ios-chrome': {
      title: 'أضف التطبيق إلى شاشتك الرئيسية (Chrome iOS)',
      steps: [
        { icon: '⋯', text: 'اضغط على النقاط الثلاث (⋯) في أسفل الشاشة' },
        { icon: '📋', text: 'اختر "إضافة إلى الشاشة الرئيسية"' },
        { icon: '✅', text: 'اضغط "إضافة" لتأكيد التثبيت' },
      ],
    },
    'ios-firefox': {
      title: 'أضف التطبيق إلى شاشتك الرئيسية (Firefox iOS)',
      steps: [
        { icon: '⋯', text: 'اضغط على زر القائمة (⋯) في الشريط السفلي' },
        { icon: '📋', text: 'اختر "إضافة إلى الشاشة الرئيسية"' },
        { icon: '✅', text: 'اضغط "إضافة" لتأكيد التثبيت' },
      ],
    },
    'firefox-android': {
      title: 'أضف التطبيق إلى شاشتك الرئيسية (Firefox)',
      steps: [
        { icon: '⋮', text: 'اضغط على النقاط الثلاث (⋮) في الزاوية العلوية اليمنى' },
        { icon: '📋', text: 'اختر "تثبيت" أو "إضافة إلى الشاشة الرئيسية"' },
        { icon: '✅', text: 'اضغط "إضافة" لتأكيد التثبيت' },
      ],
    },
    samsung: {
      title: 'أضف التطبيق إلى شاشتك الرئيسية (Samsung Internet)',
      steps: [
        { icon: '☰', text: 'اضغط على أيقونة القائمة (☰) في الشريط السفلي' },
        { icon: '➕', text: 'اختر "إضافة صفحة إلى" ثم "الشاشة الرئيسية"' },
        { icon: '✅', text: 'اضغط "إضافة" لتأكيد التثبيت' },
      ],
    },
    'opera-android': {
      title: 'أضف التطبيق إلى شاشتك الرئيسية (Opera)',
      steps: [
        { icon: '⋮', text: 'اضغط على النقاط الثلاث (⋮) في الزاوية العلوية اليمنى' },
        { icon: '📋', text: 'اختر "إضافة إلى الشاشة الرئيسية"' },
        { icon: '✅', text: 'اضغط "إضافة" لتأكيد التثبيت' },
      ],
    },
    'edge-android': {
      title: 'أضف التطبيق إلى شاشتك الرئيسية (Edge)',
      steps: [
        { icon: '⋯', text: 'اضغط على النقاط الثلاث (⋯) في الشريط السفلي' },
        { icon: '📱', text: 'اختر "إضافة إلى الهاتف" أو "إضافة إلى الشاشة الرئيسية"' },
        { icon: '✅', text: 'اضغط "إضافة" لتأكيد التثبيت' },
      ],
    },
    unknown: {
      title: 'أضف التطبيق إلى شاشتك الرئيسية',
      steps: [
        { icon: '⋮', text: 'افتح قائمة المتصفح (النقاط الثلاث أو زر المشاركة)' },
        { icon: '📋', text: 'ابحث عن خيار "إضافة إلى الشاشة الرئيسية"' },
        { icon: '✅', text: 'اضغط "إضافة" لتأكيد التثبيت' },
      ],
    },
  },
  zh: {
    'chrome-android': null,
    'ios-safari': {
      title: '将应用添加到主屏幕（Safari）',
      steps: [
        { icon: '⬆️', text: '点击底部工具栏中的分享按钮' },
        { icon: '📋', text: '向下滑动并选择“添加到主屏幕”' },
        { icon: '✅', text: '点击右上角“添加”' },
      ],
    },
    'ios-chrome': {
      title: '将应用添加到主屏幕（Chrome iOS）',
      steps: [
        { icon: '⋯', text: '点击屏幕底部的三点（⋯）' },
        { icon: '📋', text: '选择“添加到主屏幕”' },
        { icon: '✅', text: '点击“添加”确认' },
      ],
    },
    'ios-firefox': {
      title: '将应用添加到主屏幕（Firefox iOS）',
      steps: [
        { icon: '⋯', text: '点击底部栏中的菜单按钮（⋯）' },
        { icon: '📋', text: '选择“添加到主屏幕”' },
        { icon: '✅', text: '点击“添加”确认' },
      ],
    },
    'firefox-android': {
      title: '将应用添加到主屏幕（Firefox）',
      steps: [
        { icon: '⋮', text: '点击右上角三点（⋮）' },
        { icon: '📋', text: '选择“安装”或“添加到主屏幕”' },
        { icon: '✅', text: '点击“添加”确认' },
      ],
    },
    samsung: {
      title: '将应用添加到主屏幕（Samsung Internet）',
      steps: [
        { icon: '☰', text: '点击底部栏中的菜单图标（☰）' },
        { icon: '➕', text: '选择“添加页面到”，然后选择“主屏幕”' },
        { icon: '✅', text: '点击“添加”确认' },
      ],
    },
    'opera-android': {
      title: '将应用添加到主屏幕（Opera）',
      steps: [
        { icon: '⋮', text: '点击右上角三点（⋮）' },
        { icon: '📋', text: '选择“添加到主屏幕”' },
        { icon: '✅', text: '点击“添加”确认' },
      ],
    },
    'edge-android': {
      title: '将应用添加到主屏幕（Edge）',
      steps: [
        { icon: '⋯', text: '点击底部栏中的三点（⋯）' },
        { icon: '📱', text: '选择“添加到手机”或“添加到主屏幕”' },
        { icon: '✅', text: '点击“添加”确认' },
      ],
    },
    unknown: {
      title: '将应用添加到主屏幕',
      steps: [
        { icon: '⋮', text: '打开浏览器菜单（三点或分享）' },
        { icon: '📋', text: '查找“添加到主屏幕”' },
        { icon: '✅', text: '点击“添加”确认' },
      ],
    },
  },
  tr: {
    'chrome-android': null,
    'ios-safari': {
      title: 'Uygulamayı Ana Ekrana ekleyin (Safari)',
      steps: [
        { icon: '⬆️', text: 'Alt araç çubuğundaki Paylaş düğmesine dokunun' },
        { icon: '📋', text: 'Aşağı kaydırıp “Ana Ekrana Ekle”yi seçin' },
        { icon: '✅', text: 'Sağ üstteki “Ekle”ye dokunun' },
      ],
    },
    'ios-chrome': {
      title: 'Uygulamayı Ana Ekrana ekleyin (Chrome iOS)',
      steps: [
        { icon: '⋯', text: 'Ekranın altındaki üç noktaya (⋯) dokunun' },
        { icon: '📋', text: '“Ana Ekrana Ekle”yi seçin' },
        { icon: '✅', text: 'Onaylamak için “Ekle”ye dokunun' },
      ],
    },
    'ios-firefox': {
      title: 'Uygulamayı Ana Ekrana ekleyin (Firefox iOS)',
      steps: [
        { icon: '⋯', text: 'Alt çubuktaki menü düğmesine (⋯) dokunun' },
        { icon: '📋', text: '“Ana Ekrana Ekle”yi seçin' },
        { icon: '✅', text: 'Onaylamak için “Ekle”ye dokunun' },
      ],
    },
    'firefox-android': {
      title: 'Uygulamayı Ana Ekrana ekleyin (Firefox)',
      steps: [
        { icon: '⋮', text: 'Sağ üstteki üç noktaya (⋮) dokunun' },
        { icon: '📋', text: '“Yükle” veya “Ana Ekrana Ekle”yi seçin' },
        { icon: '✅', text: 'Onaylamak için “Ekle”ye dokunun' },
      ],
    },
    samsung: {
      title: 'Uygulamayı Ana Ekrana ekleyin (Samsung Internet)',
      steps: [
        { icon: '☰', text: 'Alt çubuktaki menü simgesine (☰) dokunun' },
        { icon: '➕', text: '“Sayfayı şuraya ekle” sonra “Ana ekran”ı seçin' },
        { icon: '✅', text: 'Onaylamak için “Ekle”ye dokunun' },
      ],
    },
    'opera-android': {
      title: 'Uygulamayı Ana Ekrana ekleyin (Opera)',
      steps: [
        { icon: '⋮', text: 'Sağ üstteki üç noktaya (⋮) dokunun' },
        { icon: '📋', text: '“Ana Ekrana Ekle”yi seçin' },
        { icon: '✅', text: 'Onaylamak için “Ekle”ye dokunun' },
      ],
    },
    'edge-android': {
      title: 'Uygulamayı Ana Ekrana ekleyin (Edge)',
      steps: [
        { icon: '⋯', text: 'Alt çubuktaki üç noktaya (⋯) dokunun' },
        { icon: '📱', text: '“Telefona ekle” veya “Ana Ekrana Ekle”yi seçin' },
        { icon: '✅', text: 'Onaylamak için “Ekle”ye dokunun' },
      ],
    },
    unknown: {
      title: 'Uygulamayı Ana Ekrana ekleyin',
      steps: [
        { icon: '⋮', text: 'Tarayıcı menüsünü açın (üç nokta veya Paylaş)' },
        { icon: '📋', text: '“Ana Ekrana Ekle” seçeneğini bulun' },
        { icon: '✅', text: 'Onaylamak için “Ekle”ye dokunun' },
      ],
    },
  },
};

const DISMISSED_KEY = 'pwa_install_banner_dismissed';

function detectBrowser(): BrowserType {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  if (isIOS) {
    if (/CriOS/i.test(ua)) return 'ios-chrome';
    if (/FxiOS/i.test(ua)) return 'ios-firefox';
    return 'ios-safari';
  }
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/OPR|Opera/i.test(ua)) return 'opera-android';
  if (/EdgA/i.test(ua)) return 'edge-android';
  if (/Firefox/i.test(ua)) return 'firefox-android';
  return 'chrome-android';
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return !!nav.standalone;
}

function isPermanentlyDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch (_) {
    return false;
  }
}

function markPermanentlyDismissed(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
  } catch (_) {}
}

export default function PWAInstallBanner() {
  const { language, dir } = useLanguage();
  const copy = BANNER_COPY[language] || BANNER_COPY.en;

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [browser, setBrowser] = useState<BrowserType>('unknown');

  useEffect(() => {
    // Never show if already running as installed PWA
    if (isStandalone()) return;

    // Never show if user has permanently dismissed the banner
    if (isPermanentlyDismissed()) return;

    const detected = detectBrowser();
    setBrowser(detected);

    // Listen for Chrome/Edge native install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // For browsers that don't fire beforeinstallprompt, show manual steps after 3s
    const noPromptBrowsers: BrowserType[] = [
      'ios-safari', 'ios-chrome', 'ios-firefox',
      'firefox-android', 'samsung', 'opera-android',
      'edge-android', 'unknown',
    ];
    if (noPromptBrowsers.includes(detected)) {
      const timer = setTimeout(() => {
        // Re-check dismissal in case it was set while the timer was running
        if (!isPermanentlyDismissed() && !isStandalone()) {
          setShowBanner(true);
        }
      }, 3000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handler);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Also hide banner if app gets installed during session
  useEffect(() => {
    const handleAppInstalled = () => {
      setShowBanner(false);
      markPermanentlyDismissed();
    };
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => window.removeEventListener('appinstalled', handleAppInstalled);
  }, []);

  const handleNativeInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
      markPermanentlyDismissed();
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    // Permanently dismiss — will never show again on any future visit
    markPermanentlyDismissed();
    setShowBanner(false);
    setShowSteps(false);
  };

  if (!showBanner) return null;

  const stepsConfig = (BROWSER_STEPS[language] || BROWSER_STEPS.en)[browser];
  const isNativePrompt = browser === 'chrome-android' && !!deferredPrompt;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-orange-400 shadow-2xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      dir={dir}
    >
      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 rounded-2xl overflow-hidden bg-orange-50 border border-orange-200">
            <img
              src="/assets/images/app_logo.png"
              alt={copy.alt}
              className="w-full h-full object-contain p-1"
            />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 leading-tight">
              {copy.title}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 leading-snug">
              {copy.subtitle}
            </p>
          </div>

          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 p-1 -mt-0.5"
            aria-label={copy.close}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isNativePrompt && (
          <button
            onClick={handleNativeInstall}
            className="mt-3 w-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-sm font-semibold py-3 px-4 rounded-xl transition-colors duration-150 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {copy.install}
          </button>
        )}

        {!isNativePrompt && stepsConfig && (
          <>
            <button
              onClick={() => setShowSteps((v) => !v)}
              className="mt-3 w-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-sm font-semibold py-3 px-4 rounded-xl transition-colors duration-150 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              {showSteps ? copy.hideSteps : copy.howTo}
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${showSteps ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showSteps && (
              <div className="mt-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                <p className="text-xs font-bold text-orange-800 mb-3">{stepsConfig.title}</p>
                <ol className="space-y-2">
                  {stepsConfig.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <div className="flex items-start gap-1.5 flex-1">
                        <span className="text-base leading-none mt-0.5">{step.icon}</span>
                        <span className="text-xs text-orange-900 leading-snug">{step.text}</span>
                      </div>
                    </li>
                  ))}
                </ol>
                {browser === 'ios-safari' && (
                  <div className="mt-3 flex items-center justify-center gap-2 bg-white border border-orange-200 rounded-lg px-3 py-2">
                    <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    <span className="text-xs text-gray-600 font-medium">
                      {copy.iosShareHint}
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
