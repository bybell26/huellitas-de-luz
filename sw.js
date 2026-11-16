/**
 * sw.js — Service Worker para Huellitas de Luz PWA.
 *
 * Estrategia:
 * - Shell estático (HTML, CSS, JS): Cache-first con actualización en background.
 * - API (/api/*): Network-only — nunca cachear datos de autenticación o pago.
 * - Fallback offline: sirve la última versión cacheada del shell.
 */

const CACHE_NAME    = 'huellitas-v1';
const CACHE_TIMEOUT = 5000; // ms antes de caer al caché en conexión lenta

const SHELL_URLS = [
  '/index.html',
  '/login.html',
  '/display.html',
  '/css/global.css',
  '/css/creator.css',
  '/css/display.css',
  '/css/login.css',
  '/js/auth.js',
  '/js/api.js',
  '/js/pets.js',
  '/js/storage.js',
  '/js/ws.js',
  '/js/payment-flow.js',
  '/js/animations.js',
  '/js/app.js',
  '/js/display.js',
  '/manifest.json',
];

// ─── Instalación — pre-cachear el shell ──────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

// ─── Activación — limpiar cachés viejos ──────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Nunca interceptar: API, WebSocket, recursos externos
  if (url.pathname.startsWith('/api/') || url.protocol === 'ws:' || url.protocol === 'wss:') {
    return; // pasa directo a la red
  }

  // Solo interceptar GET del mismo origen
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then(cached => {
      // Revalidar en background (stale-while-revalidate)
      const networkFetch = fetch(request).then(response => {
        if (response.ok) {
          caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
        }
        return response;
      }).catch(() => null);

      // Devolver caché inmediatamente si existe, o esperar red
      return cached || networkFetch;
    })
  );
});
