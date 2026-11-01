// =====================================================================
// sw.js — Service worker de la app (funciona sin conexión + notificaciones)
// =====================================================================
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

// Guarda la app para que abra sin conexión
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// Notificaciones push (las envía el servidor cuando sale un turno)
self.addEventListener('push', (evento) => {
  let datos = {};
  try {
    datos = evento.data ? evento.data.json() : {};
  } catch {
    datos = { cuerpo: evento.data ? evento.data.text() : '' };
  }
  const titulo = datos.titulo || 'Quiniela al Toque';
  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.cuerpo || 'Ya salieron nuevos resultados.',
      icon: '/iconos/icono-192.png',
      badge: '/iconos/icono-192.png',
      tag: datos.etiqueta || 'quiniela',
      // Si es una actualización del mismo aviso (llegaron más quinielas), no vuelve a sonar
      renotify: !datos.silencioso,
      silent: Boolean(datos.silencioso),
      data: { url: datos.url || '/#/resultados', premio: Boolean(datos.premio) },
    }),
  );
});

// Al tocar la notificación, abre (o enfoca) la app en la pantalla indicada
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const url = evento.notification.data?.url || '/';
  // Si era un premio, ya lo vio: el servidor no le manda el resumen de la mañana
  if (evento.notification.data?.premio) {
    const api = (import.meta.env.VITE_API_URL || 'https://api.quinielaaltoque.app').replace(/\/$/, '');
    evento.waitUntil(
      self.registration.pushManager.getSubscription()
        .then((s) => s && fetch(`${api}/api/push/visto`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: s.endpoint }) }))
        .catch(() => {}),
    );
  }
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if ('focus' in v) {
          v.navigate(url);
          return v.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
