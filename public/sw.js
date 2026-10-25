const CACHE_NAME = 'directhub-v7';
const STATIC_ASSETS = [
  '/offline.html',
  '/manifest.json',
  '/favicon.ico',
  '/assets/directhub-icon-official.svg',
  '/assets/images/app_logo.png',
];

// ── Install: pre-cache static shell ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch(() => {})
    )
  );
  self.skipWaiting();
});

// ── Activate: purge old caches ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch strategy ────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // ── CRITICAL: Never intercept Supabase requests ───────────────────────────
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.io') ||
    url.pathname.includes('/auth/v1/') ||
    url.pathname.includes('/rest/v1/') ||
    url.pathname.includes('/storage/v1/')
  ) {
    return;
  }

  // ── CRITICAL: Never intercept Next.js internal requests ──────────────────
  // Next.js chunks have immutable hashed URLs — the browser HTTP cache handles
  // them correctly. Serving stale chunks from SW causes webpack module factory
  // errors ("Cannot read properties of undefined (reading 'call')").
  if (url.pathname.startsWith('/_next/')) {
    return;
  }

  // Navigation requests: network-first, fallback to offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((response) => {
          if (response && response.status < 500) return response;
          return response;
        })
        .catch(() =>
          caches.match('/offline.html').then(
            (cached) =>
              cached ||
              new Response('<h1>Offline</h1>', {
                status: 503,
                headers: { 'Content-Type': 'text/html' },
              })
          )
        )
    );
    return;
  }

  // API routes: network-only (never cache dynamic data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(
        () => new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // Static assets (icons, images, fonts): stale-while-revalidate
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf)$/)
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          const networkFetch = fetch(event.request)
            .then((response) => {
              if (response && response.status === 200) {
                cache.put(event.request, response.clone());
              }
              return response;
            })
            .catch(() => cached || new Response('', { status: 503 }));
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // Everything else: network-first, cache fallback
  // RSC / Next data requests must never be cached: stale payloads reference
  // chunk ids that no longer exist and trigger
  // "__webpack_modules__[moduleId] is not a function".
  const isRscRequest =
    url.searchParams.has('_rsc') ||
    event.request.headers.get('RSC') === '1' ||
    event.request.headers.get('Next-Router-State-Tree') !== null ||
    event.request.headers.get('Accept') === 'text/x-component';
  if (isRscRequest) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const ct = response.headers.get('Content-Type') || '';
          if (!ct.includes('text/html') && !ct.includes('text/x-component')) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(
          (cached) => cached || new Response('', { status: 503 })
        )
      )
  );
});

// ── Push notifications (Rich / Image support — Alibaba style) ────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: 'دايركت هب', body: event.data.text() };
  }

  const title = data.title || 'دايركت هب';
  const options = {
    body: data.body || '',
    icon: data.icon || '/api/icons/192',
    badge: '/api/icons/192',
    // Rich image — shown as large banner (Alibaba-style)
    image: data.image || undefined,
    dir: 'rtl',
    lang: 'ar',
    vibrate: [200, 100, 200],
    requireInteraction: data.requireInteraction || false,
    silent: false,
    tag: data.tag || 'directhub-broadcast',
    renotify: true,
    data: {
      url: data.url || '/',
      broadcastId: data.broadcastId || null,
      timestamp: Date.now(),
    },
    actions: data.actions || [
      {
        action: 'open',
        title: 'فتح',
      },
      {
        action: 'dismiss',
        title: 'إغلاق',
      },
    ],
  };

  // Remove undefined image to avoid errors on browsers that don't support it
  if (!options.image) {
    delete options.image;
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Notification click handler ────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if already open
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ── Push subscription change ──────────────────────────────────────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription?.options?.applicationServerKey,
    }).then((subscription) => {
      // Re-register the new subscription with the server
      return fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription, action: 'resubscribe' }),
      });
    }).catch(() => {})
  );
});
