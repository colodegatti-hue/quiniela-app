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
  const titulo = datos.titulo || 'Quiniela';
  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.cuerpo || 'Ya salieron nuevos resultados.',
      icon: '/iconos/icono-192.png',
      badge: '/iconos/icono-192.png',
      tag: datos.etiqueta || 'quiniela',
      // Si es una actualización del mismo aviso (llegaron más quinielas), no vuelve a sonar
      renotify: !datos.silencioso,
      silent: Boolean(datos.silencioso),
      data: { url: datos.url || '/#/resultados' },
    }),
  );
});

// Al tocar la notificación, abre (o enfoca) la app en la pantalla indicada
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const url = evento.notification.data?.url || '/';
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
