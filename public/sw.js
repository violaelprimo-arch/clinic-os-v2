// Clinic OS / Yalla Clinic - Service Worker for Background Web Push Notifications

const CACHE_NAME = 'clinic-os-pwa-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Handle incoming background Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {
    title: 'تنبيه من Yalla Clinic',
    body: 'لديك إشعار جديد بخصوص حجزك في العيادة.',
    icon: '/brand/yalla-clinic/app-icon.png',
    badge: '/favicon-32x32.png',
    url: '/',
    tag: `clinic-alert-${Date.now()}`,
    type: 'general',
  };

  try {
    const parsed = event.data.json();
    payload = { ...payload, ...parsed };
  } catch (e) {
    try {
      payload.body = event.data.text() || payload.body;
    } catch {}
  }

  // Validate target URL: ensure safe relative or same-origin path
  let safeUrl = '/';
  if (payload.url && typeof payload.url === 'string') {
    if (payload.url.startsWith('/') && !payload.url.startsWith('//')) {
      safeUrl = payload.url;
    } else {
      try {
        const parsedUrl = new URL(payload.url, self.location.origin);
        if (parsedUrl.origin === self.location.origin) {
          safeUrl = parsedUrl.pathname + parsedUrl.search + parsedUrl.hash;
        }
      } catch {}
    }
  }

  const isTurnReady = payload.type === 'turn_ready';

  const notificationPromise = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((windowClients) => {
      // Broadcast to any open tabs so in-app state/bell updates immediately
      windowClients.forEach((client) => {
        client.postMessage({
          type: 'PUSH_NOTIFICATION_RECEIVED',
          payload: { ...payload, url: safeUrl },
        });
      });

      // If the patient is actively looking at this exact tracking page, suppress visual duplicate unless urgent
      const isActivelyViewing = windowClients.some(
        (c) => c.visibilityState === 'visible' && c.url.includes(safeUrl)
      );

      if (isActivelyViewing && !isTurnReady) {
        return;
      }

      const options = {
        body: payload.body,
        icon: payload.icon || '/brand/yalla-clinic/app-icon.png',
        badge: payload.badge || '/favicon-32x32.png',
        dir: 'rtl',
        lang: 'ar',
        tag: payload.tag || `yalla-${payload.appointmentId || 'general'}-${payload.type || Date.now()}`,
        renotify: true,
        vibrate: isTurnReady ? [350, 150, 350, 150, 350] : [200, 100, 200],
        requireInteraction: isTurnReady,
        data: {
          url: safeUrl,
          type: payload.type,
          appointmentId: payload.appointmentId,
          receivedAt: Date.now(),
        },
        actions: [
          {
            action: 'open',
            title: isTurnReady ? 'الدخول للعيادة الآن' : 'عرض التفاصيل',
          },
        ],
      };

      return self.registration.showNotification(payload.title, options);
    });

  event.waitUntil(notificationPromise);
});

// Handle click on notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = data.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a tab is already open on this URL or tracking page, focus and navigate it
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }

      // If any clinic tab is open, reuse it and navigate to targetUrl
      for (const client of windowClients) {
        if ('focus' in client && 'navigate' in client) {
          client.focus();
          return client.navigate(targetUrl);
        }
      }

      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
