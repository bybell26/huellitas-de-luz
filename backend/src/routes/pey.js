import { Router } from 'express';
import { getPeyKey } from '../services/pey-key.js';
import pool from '../db/pool.js';
import { TRICKS, donationCents, applyDonation } from '../services/donations.js';
import { requireAuth } from '../middleware/auth.js';
import pricing from '../../../js/creation-pricing.js';

const router = Router();
router.post('/', requireAuth, async (req, res) => {
  const { action, id, nextToken } = req.body ?? {};
  if (action !== 'create' && !(action === 'status' && typeof id === 'string' && /^[A-Za-z0-9_-]+$/.test(id))) {
    return res.status(400).json({ error: 'Acción no permitida.' });
  }
  try {
    let order;
    const purpose = req.body.purpose ?? 'creation';
    let amount = .01, petId = null, trick = null;
    if (action === 'create') {
      if (!['creation', 'extra'].includes(purpose)) return res.status(400).json({error:'Tipo de donación inválido.'});
      if (purpose === 'creation') {
        const cents = pricing.creationCents(req.body.amount);
        if (cents === null) return res.status(400).json({ error: 'Elige $50, $100, $150, $200 MXN u otra cantidad mayor a $200, con hasta dos decimales.' });
        amount = cents / 100;
      }
      if (purpose === 'extra') {
        const cents = donationCents(req.body.amount);
        if (cents === null) return res.status(400).json({error:'Elige un monto entre $0.01 y $1,000 MXN, con hasta dos decimales.'});
        const pet = (await pool.query('SELECT id, species FROM pets WHERE id = $1', [req.body.petId])).rows[0];
        if (!pet) return res.status(404).json({error:'Mascota no encontrada.'});
        if (!TRICKS[pet.species].includes(req.body.trick)) return res.status(400).json({error:'Truco inválido para esta mascota.'});
        amount = cents / 100; petId = pet.id; trick = req.body.trick;
      }
    }
    if (action === 'status') {
      const owned = await pool.query('SELECT * FROM payment_requests WHERE qr_id = $1 AND user_id = $2', [id, req.user.id]);
      if (!owned.rows.length) return res.status(404).json({ error: 'Cobro no encontrado.' });
      order = owned.rows[0];
    }
    const token = await getPeyKey();
    const creating = action === 'create';
    let endpoint = creating ? '/codi/qr' : '/transaction/codi/qr/' + id;
    if (!creating && typeof nextToken === 'string' && nextToken) endpoint += '?nextToken=' + encodeURIComponent(nextToken);
    const upstream = await fetch('https://api.pey.mx' + endpoint, {
      method: creating ? 'POST' : 'GET',
      headers: { Accept: 'application/json', Authorization: 'Bearer ' + token, ...(creating ? { 'Content-Type': 'application/json' } : {}) },
      ...(creating ? { body: JSON.stringify({ amount, concept: purpose === 'extra' ? 'Donación extra Huellitas' : 'Huellitas de Luz', expiration: 600, numRef: '1', generateImage: true }) } : {}),
      redirect: 'error', signal: AbortSignal.timeout(30000),
    });
    const raw = await upstream.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = raw; }

    if (!upstream.ok) {
      const type = typeof data?.error?.type === 'string' ? data.error.type : 'PEY_ERROR';
      const messages = {
        INVALID_STATE: 'Pey indica que CoDi no está habilitado o no está disponible para esta cuenta.',
        PEY_CONSISTENCY_ERROR: 'Pey indica que falta configurar o activar la cuenta bancaria receptora de CoDi.',
        INVALID_AMOUNT: 'Pey rechazó el monto de este cobro.',
        INVALID_PARAMETER: 'Pey rechazó un parámetro del cobro. Revisa la configuración de CoDi.',
        INVALID_REQUEST: 'Pey rechazó los datos enviados para crear el CoDi.',
      };
      const message = [401,403].includes(upstream.status)
        ? 'Pey rechazó la API key o sus permisos de CoDi. Revisa PEY_API_KEY en backend/.env.'
        : upstream.status === 429 ? 'Pey está limitando las solicitudes. Espera unos segundos antes de reintentar.'
        : messages[type] || 'Pey no pudo completar el cobro. Inténtalo más tarde.';
      return res.status(502).json({
        ok: false, status: upstream.status, error: message,
        code: /^[A-Z_0-9]{1,80}$/.test(type) ? type : 'PEY_ERROR',
      });
    }

    if (upstream.ok && creating) {
      if (typeof data?.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(data.id)) return res.status(502).json({ error: 'Pey devolvió un cobro inválido.' });
      await pool.query('INSERT INTO payment_requests (qr_id, user_id, amount, purpose, pet_id, trick) VALUES ($1, $2, $3, $4, $5, $6)', [data.id, req.user.id, amount, purpose, petId, trick]);
    }
    if (upstream.ok && !creating) {
      for (const item of Array.isArray(data?.items) ? data.items : []) {
        if (item.status !== 'PAID' || pricing.moneyCents(Number(item.amount)) !== Math.round(Number(order.amount) * 100) || (item.currency && item.currency !== 'MXN') ||
            typeof item.id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(item.id)) continue;
        await pool.query(
          "INSERT INTO payment_receipts (transaction_id, qr_id, user_id, amount, currency) VALUES ($1, $2, $3, $4, 'MXN') ON CONFLICT (transaction_id) DO NOTHING",
          [item.id, id, req.user.id, Number(order.amount)]
        );
        if (order.purpose === 'extra') {
          item.donationEvent = await applyDonation(item, order, req.user.id);
          if (!item.donationEvent) return res.status(409).json({error:'El recibo no corresponde a esta donación.'});
        }
      }
    }
    return res.json({ ok: upstream.ok, status: upstream.status, data });
  } catch (err) {
    if (err.code === 'PEY_NOT_CONFIGURED') return res.status(503).json({ error: err.message });
    console.error('[pey]', err.message);
    return res.status(502).json({ error: err.name === 'TimeoutError' ? 'Pey no respondió en 30 segundos.' : 'No se pudo completar la operación de pago.' });
  }
});
export default router;
