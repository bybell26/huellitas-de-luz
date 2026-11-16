import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';

/**
 * Mapa de salas activas: roomCode → Set<WebSocket>
 * Cada cliente se une a una sala por su código y recibe
 * todos los eventos broadcast de esa sala.
 */
const rooms = new Map();

/**
 * Envía un mensaje JSON a todos los clientes conectados a una sala.
 * Los clientes con conexión cerrada se limpian automáticamente.
 */
export function broadcast(roomCode, message) {
  const clients = rooms.get(roomCode);
  if (!clients) return;

  const payload = JSON.stringify(message);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    } else {
      clients.delete(ws);
    }
  }
  if (clients.size === 0) rooms.delete(roomCode);
}

/**
 * Adjunta el servidor WebSocket al servidor HTTP de Express.
 * 
 * Protocolo de conexión del cliente:
 *   ws://host/ws?room=abc-1234&token=JWT
 * 
 * Mensajes del servidor al cliente:
 *   { type: 'joined',       room: code, petCount: n }
 *   { type: 'pet_added',    pet: {...} }
 *   { type: 'pet_removed',  petId: string }
 *   { type: 'room_cleared' }
 *   { type: 'error',        message: string }
 * 
 * Mensajes del cliente al servidor:
 *   { type: 'ping' }  → responde { type: 'pong' }
 */
export function attachWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url    = new URL(req.url, `http://${req.headers.host}`);
    const code   = url.searchParams.get('room');
    const token  = url.searchParams.get('token');

    // Validar código de sala
    if (!code || !/^[a-z]+-\d{4}$/.test(code)) {
      ws.send(JSON.stringify({ type: 'error', message: 'Código de sala inválido.' }));
      return ws.close(1008, 'invalid_room');
    }

    // Validar JWT (opcional pero recomendado; display.html puede conectar sin auth)
    let userId = null;
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        userId = payload.sub;
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Token inválido.' }));
        return ws.close(1008, 'invalid_token');
      }
    }

    // Registrar en la sala
    if (!rooms.has(code)) rooms.set(code, new Set());
    const clients = rooms.get(code);
    clients.add(ws);

    ws.send(JSON.stringify({
      type:     'joined',
      room:     code,
      clients:  clients.size,
    }));

    // Ping / pong para detectar desconexiones
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg?.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
        if (['pause', 'labels', 'replay'].includes(msg?.type) && userId) {
          const valid = msg.type === 'pause' ? typeof msg.paused === 'boolean'
            : msg.type === 'labels' ? typeof msg.visible === 'boolean'
            : typeof msg.id === 'string' && /^pey-[A-Za-z0-9_-]+$/.test(msg.id);
          if (!valid) return;
          pool.query('SELECT owner_id FROM rooms WHERE code = $1', [code]).then(result => {
            if (ws.readyState !== WebSocket.OPEN || result.rows[0]?.owner_id !== userId) return;
            const message = msg.type === 'pause' ? { type: 'pause', paused: msg.paused }
              : msg.type === 'labels' ? { type: 'labels', visible: msg.visible } : { type: 'replay', id: msg.id };
            broadcast(code, message);
          }).catch(err => console.error('[ws/control]', err.message));
        }
      } catch { /* ignorar mensajes malformados */ }
    });

    ws.on('close', () => {
      clients.delete(ws);
      if (clients.size === 0) rooms.delete(code);
    });

    ws.on('error', (err) => {
      console.error(`[ws] Error en sala ${code}:`, err.message);
      clients.delete(ws);
    });
  });

  // Heartbeat cada 30 segundos para cerrar conexiones zombi
  const heartbeat = setInterval(() => {
    for (const [code, clients] of rooms) {
      for (const ws of clients) {
        if (!ws.isAlive) {
          clients.delete(ws);
          ws.terminate();
          continue;
        }
        ws.isAlive = false;
        ws.ping();
      }
      if (clients.size === 0) rooms.delete(code);
    }
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));

  console.log('[WS] Servidor WebSocket listo en /ws');
  return wss;
}

/** Devuelve cuántos clientes hay conectados en total (útil para health check). */
export function connectedClients() {
  let total = 0;
  for (const clients of rooms.values()) total += clients.size;
  return total;
}
