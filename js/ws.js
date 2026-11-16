'use strict';
/**
 * ws.js — Cliente WebSocket para salas de constelación.
 * Reemplaza sync.js (BroadcastChannel + localStorage).
 *
 * Uso:
 *   const ws = createRoomSocket('luna-7429', onMessage);
 *   ws.send({ type: 'ping' });
 *   ws.close();
 */

const WS_BASE = (() => {
  if (typeof window !== 'undefined' && window.HUELLITAS_WS_URL) return window.HUELLITAS_WS_URL;
  const { hostname, protocol } = window.location;
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  if (hostname === 'localhost' || hostname === '127.0.0.1') return `ws://localhost:4000`;
  return `${wsProtocol}//${window.location.host}`;
})();

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECTS     = 10;

function createRoomSocket(roomCode, onMessage) {
  let socket      = null;
  let reconnects  = 0;
  let disposed    = false;
  let reconnectTimer = null;

  function connect() {
    if (disposed) return;

    const token  = getToken();
    const params = new URLSearchParams({ room: roomCode });
    if (token) params.set('token', token);

    socket = new WebSocket(`${WS_BASE}/ws?${params}`);

    socket.addEventListener('open', () => {
      reconnects = 0;
      onMessage({ type: '_connected', room: roomCode });
    });

    socket.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        onMessage(msg);
      } catch { /* ignorar mensajes malformados */ }
    });

    socket.addEventListener('close', (event) => {
      if (disposed) return;
      onMessage({ type: '_disconnected', code: event.code });

      if (reconnects < MAX_RECONNECTS) {
        reconnects++;
        const delay = RECONNECT_DELAY_MS * Math.min(reconnects, 4);
        reconnectTimer = setTimeout(connect, delay);
      } else {
        onMessage({ type: '_failed', message: 'No se pudo reconectar con la sala.' });
      }
    });

    socket.addEventListener('error', () => {
      // El evento 'close' seguirá disparándose; no es necesario manejar aquí
    });
  }

  connect();

  return {
    send(message) {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    },
    close() {
      disposed = true;
      clearTimeout(reconnectTimer);
      socket?.close();
    },
  };
}

// ─── Estado de conexión de display ───────────────────────────────────────────
// Reemplaza el heartbeat de localStorage de sync.js

const DISPLAY_STATUS_KEY = 'huellitas_display_status';

function setDisplayOnline(roomCode) {
  try {
    localStorage.setItem(DISPLAY_STATUS_KEY, JSON.stringify({ room: roomCode, ts: Date.now() }));
  } catch {}
}

function isDisplayOnline() {
  try {
    const raw = localStorage.getItem(DISPLAY_STATUS_KEY);
    if (!raw) return false;
    const { ts } = JSON.parse(raw);
    return Date.now() - ts < 6500;
  } catch { return false; }
}
