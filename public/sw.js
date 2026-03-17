// ============================================================
// Kasm UI Service Worker
// Cache-first for assets, network-first for API/collab
// Handles share target and file handler POSTs
// ============================================================

const CACHE_NAME = 'kasm-ui-v1';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install: precache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for assets, network-first for navigation
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Handle share target POST
  if (event.request.method === 'POST' && url.pathname === '/') {
    event.respondWith(handleShareTarget(event));
    return;
  }

  // WebSocket connections: pass through
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }

  // Navigation requests: network-first with cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets (JS, CSS, SVG, fonts): cache-first
  if (url.pathname.startsWith('/assets/') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.woff2')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else: network with cache fallback
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});

// Handle share target: extract shared data from POST, redirect to app
async function handleShareTarget(event) {
  const formData = await event.request.formData();
  const title = formData.get('shared_title') || '';
  const text = formData.get('shared_text') || '';
  const sharedUrl = formData.get('shared_url') || '';
  const files = formData.getAll('shared_files');

  // Store shared data in a temporary cache for the app to pick up
  const shareData = { title, text, url: sharedUrl, fileCount: files.length };

  const cache = await caches.open('kasm-share-target');
  await cache.put(
    new Request('/_shared'),
    new Response(JSON.stringify(shareData), {
      headers: { 'Content-Type': 'application/json' },
    })
  );

  // Store files if any
  if (files.length > 0) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      await cache.put(
        new Request(`/_shared/file/${i}/${file.name}`),
        new Response(file)
      );
    }
  }

  // Redirect to the app
  return Response.redirect('/?share=true', 303);
}

// Handle push notifications (future)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Kasm UI', {
      body: data.body || '',
      icon: '/icons/icon-192.svg',
      badge: '/icons/icon-96.svg',
      tag: data.tag || 'kasm-notification',
      data: data.url || '/',
    })
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Focus existing window or open new
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(event.notification.data || '/');
    })
  );
});

// Periodic background sync (future)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'kasm-vfs-sync') {
    event.waitUntil(
      // Could trigger VFS sync to OPFS here
      Promise.resolve()
    );
  }
});
