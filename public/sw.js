// Clinic OS V2 - Service Worker for PWA & Background Web Push Notifications

const CACHE_NAME = 'clinic-os-pwa-v1';

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
  let payload = {
    title: 'تنبيه من Yalla Clinic',
    body: 'لديك إشعار جديد بخصوص حجزك في العيادة.',
    url: '/',
    tag: 'yalla-clinic-alert'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch (e) {
      payload.body = event.data.text() || payload.body;
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon || '/icons/icon-192.svg',
    badge: payload.badge || '/icons/icon-192.svg',
    dir: 'rtl',
    lang: 'ar',
    tag: payload.tag || `clinic-push-${Date.now()}`,
    renotify: true,
    vibrate: [250, 100, 250, 100, 250],
    data: {
      url: payload.url || '/'
    },
    actions: [
      {
        action: 'open',
        title: 'عرض التحديث'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// Handle click on notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a tab is already open with the url, focus it
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
