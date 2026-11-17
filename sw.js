/**
 * sw.js — Service Worker para Huellitas de Luz PWA.
 *
 * Estrategia:
 * - Shell estático (HTML, CSS, JS): Network-first para evitar scripts de pagos antiguos.
 * - API (/api/*): Network-only — nunca cachear datos de autenticación o pago.
 * - Fallback offline: sirve la última versión cacheada del shell.
 */

const CACHE_NAME    = 'huellitas-v15-limite-diario';

const SHELL_URLS = [
  '/index.html',
  '/login.html',
  '/display.html',
  '/hogar.html',
  '/actividad.html',
  '/css/actividad.css',
  '/js/actividad.js',
  '/css/hogar.css',
  '/js/hogar.js',
  '/js/pet-activities.js',
  '/css/pet-activities.css',
  '/css/global.css',
  '/css/creator.css',
  '/css/display.css',
  '/css/pet-motion.css',
  '/css/login.css',
  '/js/auth.js',
  '/js/api.js',
  '/js/pets.js',
  '/js/storage.js',
  '/js/ws.js',
  '/js/payment-flow.js',
  '/js/creation-pricing.js',
  '/js/animations.js',
  '/js/pets-motion.js',
  '/js/pet-appearance.js',
  '/js/scene-tools.js',
  '/js/pet-donations.js',
  '/js/pet-roaming.js',
  '/js/display-modal.js',
  '/js/app.js',
  '/js/display.js',
  '/manifest.json',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
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

  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    // HTML y scripts siempre actuales al tener conexión.
    const response = await fetch(request, { cache: 'no-store' });
    if (response.ok) {
      try { await cache.put(request, response.clone()); } catch { /* La caché nunca debe ocultar una respuesta actual. */ }
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || Response.error();
  }
}
