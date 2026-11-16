import { Router } from 'express';
import pool from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { broadcast } from '../ws/rooms.js';

const router = Router();
const MAX_PETS_PER_ROOM = 42;

// Genera un código legible tipo "luna-7429"
function generateCode() {
  const words = ['luna', 'nova', 'orion', 'vega', 'lyra', 'atlas', 'sol', 'iris', 'mira', 'zeta'];
  const word  = words[Math.floor(Math.random() * words.length)];
  const num   = Math.floor(1000 + Math.random() * 9000);
  return `${word}-${num}`;
}

// ─── POST /api/rooms — crear sala ────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const name = typeof req.body?.name === 'string'
    ? req.body.name.trim().slice(0, 60)
    : 'Mi constelación';

  // Intentamos hasta 5 veces en caso de colisión de código
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      const result = await pool.query(
        `INSERT INTO rooms (code, owner_id, name)
         VALUES ($1, $2, $3)
         RETURNING id, code, name, owner_id, created_at`,
        [code, req.user.id, name]
      );
      return res.status(201).json({ room: result.rows[0] });
    } catch (err) {
      if (err.code === '23505' && attempt < 4) continue; // colisión, reintenta
      console.error('[rooms/create]', err.message);
      return res.status(500).json({ error: 'No se pudo crear la sala.' });
    }
  }
});

// ─── GET /api/rooms/:code — obtener sala con sus mascotas ────────────────────
router.get('/:code', async (req, res) => {
  const { code } = req.params;
  if (!/^[a-z]+-\d{4}$/.test(code)) return res.status(400).json({ error: 'Código de sala inválido.' });

  try {
    const roomResult = await pool.query(
      'SELECT id, code, name, owner_id, max_pets, created_at FROM rooms WHERE code = $1',
      [code]
    );
    const room = roomResult.rows[0];
    if (!room) return res.status(404).json({ error: 'Sala no encontrada.' });

    const petsResult = await pool.query(
      `SELECT p.id, p.species, p.breed, p.collar, p.name, p.appearance, p.created_at, rp.slot,
              (COALESCE(receipt.amount, 0) + COALESCE((SELECT SUM(extra.amount) FROM pet_donations d JOIN payment_receipts extra ON extra.transaction_id = d.transaction_id WHERE d.pet_id = p.id AND extra.redeemed_at IS NOT NULL), 0))::float AS donation_amount, CASE WHEN receipt.amount IS NOT NULL OR EXISTS (SELECT 1 FROM pet_donations d WHERE d.pet_id = p.id) THEN 'MXN' END AS donation_currency
       FROM room_pets rp
       JOIN pets p ON p.id = rp.pet_id
       LEFT JOIN payment_receipts receipt ON p.id = 'pey-' || receipt.transaction_id
         AND receipt.user_id = p.user_id AND receipt.redeemed_at IS NOT NULL
       WHERE rp.room_id = $1
       ORDER BY rp.slot ASC`,
      [room.id]
    );

    return res.json({ room, pets: petsResult.rows });
  } catch (err) {
    console.error('[rooms/get]', err.message);
    return res.status(500).json({ error: 'Error al obtener la sala.' });
  }
});

// ─── GET /api/rooms — salas del usuario autenticado ──────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.code, r.name, r.created_at,
              COUNT(rp.pet_id)::int AS pet_count
       FROM rooms r
       LEFT JOIN room_pets rp ON rp.room_id = r.id
       WHERE r.owner_id = $1
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    return res.json({ rooms: result.rows });
  } catch (err) {
    console.error('[rooms/list]', err.message);
    return res.status(500).json({ error: 'Error al obtener las salas.' });
  }
});

// ─── POST /api/rooms/:code/pets — agregar mascota a sala ─────────────────────
router.post('/:code/pets', requireAuth, async (req, res) => {
  const { code } = req.params;
  const { petId } = req.body ?? {};

  if (!/^[a-z]+-\d{4}$/.test(code))                    return res.status(400).json({ error: 'Código de sala inválido.' });
  if (typeof petId !== 'string' || !petId)              return res.status(400).json({ error: 'petId requerido.' });

  const client = await pool.connect().catch(() => null);
  if (!client) return res.status(503).json({ error: 'Base de datos no disponible.' });
  try {
    await client.query('BEGIN');
    // Serializar altas por sala para que nadie elija el mismo lugar.
    const roomResult = await client.query('SELECT id, max_pets FROM rooms WHERE code = $1 FOR UPDATE', [code]);
    const room = roomResult.rows[0];
    if (!room) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sala no encontrada.' });
    }
    const petResult = await client.query(
      `SELECT p.id, p.species, p.breed, p.collar, p.name, p.appearance, p.created_at, (COALESCE(receipt.amount, 0) + COALESCE((SELECT SUM(extra.amount) FROM pet_donations d JOIN payment_receipts extra ON extra.transaction_id = d.transaction_id WHERE d.pet_id = p.id AND extra.redeemed_at IS NOT NULL), 0))::float AS donation_amount, CASE WHEN receipt.amount IS NOT NULL OR EXISTS (SELECT 1 FROM pet_donations d WHERE d.pet_id = p.id) THEN 'MXN' END AS donation_currency FROM pets p LEFT JOIN payment_receipts receipt ON p.id = 'pey-' || receipt.transaction_id AND receipt.user_id = p.user_id AND receipt.redeemed_at IS NOT NULL WHERE p.id = $1 AND p.user_id = $2 FOR KEY SHARE OF p`, [petId, req.user.id]
    );
    if (!petResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Mascota no encontrada o no te pertenece.' });
    }
    const existing = await client.query('SELECT slot FROM room_pets WHERE room_id = $1 AND pet_id = $2', [room.id, petId]);
    if (existing.rows.length) {
      await client.query('COMMIT');
      return res.json({ pet: { ...petResult.rows[0], slot: existing.rows[0].slot }, duplicate: true });
    }
    const occupied = await client.query('SELECT slot FROM room_pets WHERE room_id = $1', [room.id]);
    const used = new Set(occupied.rows.map(row => row.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    if (occupied.rows.length >= room.max_pets || slot >= room.max_pets) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'La sala está llena.' });
    }
    await client.query('INSERT INTO room_pets (room_id, pet_id, slot) VALUES ($1, $2, $3)', [room.id, petId, slot]);
    await client.query('COMMIT');
    const pet = { ...petResult.rows[0], slot };
    broadcast(code, { type: 'pet_added', pet });
    return res.status(201).json({ pet });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[rooms/addPet]', err.message);
    return res.status(500).json({ error: 'No se pudo agregar la mascota a la sala.' });
  } finally {
    client.release();
  }
});

// ─── DELETE /api/rooms/:code/pets/:petId — quitar mascota de sala ─────────────
router.delete('/:code/pets/:petId', requireAuth, async (req, res) => {
  const { code, petId } = req.params;

  try {
    const roomResult = await pool.query(
      'SELECT r.id FROM rooms r WHERE r.code = $1',
      [code]
    );
    const room = roomResult.rows[0];
    if (!room) return res.status(404).json({ error: 'Sala no encontrada.' });

    // Solo el dueño de la mascota o el dueño de la sala puede quitarla
    const authCheck = await pool.query(
      `SELECT rp.pet_id FROM room_pets rp
       JOIN pets p ON p.id = rp.pet_id
       JOIN rooms r ON r.id = rp.room_id
       WHERE rp.room_id = $1 AND rp.pet_id = $2
         AND (p.user_id = $3 OR r.owner_id = $3)`,
      [room.id, petId, req.user.id]
    );
    if (authCheck.rows.length === 0) {
      return res.status(403).json({ error: 'No tienes permiso para quitar esta mascota.' });
    }

    await pool.query('DELETE FROM room_pets WHERE room_id = $1 AND pet_id = $2', [room.id, petId]);

    broadcast(code, { type: 'pet_removed', petId });

    return res.json({ removed: petId });
  } catch (err) {
    console.error('[rooms/removePet]', err.message);
    return res.status(500).json({ error: 'No se pudo quitar la mascota.' });
  }
});

// ─── DELETE /api/rooms/:code — vaciar sala (solo owner) ──────────────────────
router.delete('/:code', requireAuth, async (req, res) => {
  const { code } = req.params;

  try {
    const roomResult = await pool.query('SELECT id, owner_id FROM rooms WHERE code = $1', [code]);
    const room = roomResult.rows[0];
    if (!room) return res.status(404).json({ error: 'Sala no encontrada.' });
    if (room.owner_id !== req.user.id) return res.status(403).json({ error: 'Solo el dueño puede vaciar la sala.' });
    await pool.query('DELETE FROM room_pets WHERE room_id = $1', [room.id]);

    broadcast(code, { type: 'room_cleared' });
    return res.json({ cleared: true });
  } catch (err) {
    console.error('[rooms/clear]', err.message);
    return res.status(500).json({ error: 'No se pudo vaciar la sala.' });
  }
});

export default router;
