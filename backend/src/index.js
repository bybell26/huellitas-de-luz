import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';

import authRouter  from './routes/auth.js';
import petsRouter  from './routes/pets.js';
import roomsRouter from './routes/rooms.js';
import peyRouter   from './routes/pey.js';
import { attachWebSocket, connectedClients } from './ws/rooms.js';

// ─── Validación de variables de entorno críticas ──────────────────────────────
const required = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`ERROR: La variable de entorno ${key} no está definida. Revisa tu .env`);
    process.exit(1);
  }
}

const app  = express();
const PORT = Number(process.env.PORT) || 4000;

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (apps nativas, Postman, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origen no permitido — ${origin}`));
  },
  credentials: true,
}));

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '64kb' }));

// ─── Seguridad básica ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// ─── Rutas ────────────────────────────────────────────────────────────────────
app.use('/api/auth',  authRouter);
app.use('/api/pets',  petsRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/pey',   peyRouter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:  'ok',
    uptime:  Math.floor(process.uptime()),
    ws_clients: connectedClients(),
    env:     process.env.NODE_ENV || 'development',
  });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  if (err.message?.startsWith('CORS')) {
    return res.status(403).json({ error: err.message });
  }
  console.error('[server]', err.message);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

// ─── HTTP + WebSocket ─────────────────────────────────────────────────────────
const httpServer = createServer(app);
attachWebSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════╗
║       Huellitas de Luz — Backend             ║
╠══════════════════════════════════════════════╣
║  API REST:   http://localhost:${PORT}           ║
║  WebSocket:  ws://localhost:${PORT}/ws          ║
║  Health:     http://localhost:${PORT}/health    ║
║  Entorno:    ${(process.env.NODE_ENV || 'development').padEnd(32)}║
╚══════════════════════════════════════════════╝
  `);
});

// Cierre limpio
process.on('SIGTERM', () => { httpServer.close(() => process.exit(0)); });
process.on('SIGINT',  () => { httpServer.close(() => process.exit(0)); });
