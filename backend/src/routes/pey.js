/**
 * Proxy Pey — migrado de pruebas-pey/server.cjs al nuevo backend.
 * La API key nunca sale del servidor; el navegador/app solo recibe
 * el resultado de la operación.
 */
import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));

async function getToken() {
  if (process.env.PEY_API_KEY) return process.env.PEY_API_KEY.trim();
  // Fallback al archivo local (solo desarrollo)
  try {
    const config = JSON.parse(
      await readFile(join(__dirname, '../../pruebas-pey/config.local.json'), 'utf8')
    );
    return config.apiKey;
  } catch {
    throw new Error('PEY_API_KEY no configurada.');
  }
}

// ─── POST /api/pey — crear QR o consultar estado ─────────────────────────────
// Requiere autenticación para evitar abuso de la API key
router.post('/', requireAuth, async (req, res) => {
  const { action, id, nextToken } = req.body ?? {};

  let method, endpoint, body;

  if (action === 'create') {
    method   = 'POST';
    endpoint = '/codi/qr';
    body     = { amount: 0.01, concept: 'Huellitas de Luz', expiration: 600, numRef: '1', generateImage: true };
  } else if (action === 'status' && typeof id === 'string' && /^[A-Za-z0-9_-]+$/.test(id)) {
    method   = 'GET';
    endpoint = '/transaction/codi/qr/' + id;
    if (typeof nextToken === 'string' && nextToken) {
      endpoint += '?nextToken=' + encodeURIComponent(nextToken);
    }
  } else {
    return res.status(400).json({ error: 'Acción no permitida.' });
  }

  try {
    const token = await getToken();
    const upstream = await fetch(`https://api.pey.mx${endpoint}`, {
      method,
      headers: {
        Accept:        'application/json',
        Authorization: `Bearer ${token}`,
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
      redirect: 'error',
      signal:   AbortSignal.timeout(30000),
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    return res.json({ ok: upstream.ok, status: upstream.status, data });
  } catch (err) {
    const message = err.name === 'TimeoutError'
      ? 'Pey no respondió en 30 segundos.'
      : 'No fue posible conectar con Pey.';
    console.error('[pey]', err.message);
    return res.status(502).json({ error: message });
  }
});

export default router;
