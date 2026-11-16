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
      `SELECT p.id, p.species, p.breed, p.collar, p.name, p.created_at, rp.slot
       FROM room_pets rp
       JOIN pets p ON p.id = rp.pet_id
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

  try {
    // Verificar que la sala existe y la mascota pertenece al usuario
    const [roomResult, petResult] = await Promise.all([
      pool.query('SELECT id, max_pets FROM rooms WHERE code = $1', [code]),
      pool.query('SELECT id FROM pets WHERE id = $1 AND user_id = $2', [petId, req.user.id]),
    ]);

    const room = roomResult.rows[0];
    if (!room) return res.status(404).json({ error: 'Sala no encontrada.' });

    const pet = petResult.rows[0];
    if (!pet) return res.status(404).json({ error: 'Mascota no encontrada o no te pertenece.' });

    // Verificar límite y calcular slot libre
    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS total, ARRAY_AGG(slot) AS slots FROM room_pets WHERE room_id = $1',
      [room.id]
    );
    const { total, slots } = countResult.rows[0];
    if (total >= room.max_pets) {
      return res.status(409).json({ error: `La sala está llena (máx. ${room.max_pets} mascotas).` });
    }

    const usedSlots = new Set((slots ?? []).filter(s => s !== null));
    let slot = 0;
    while (usedSlots.has(slot)) slot++;

    const result = await pool.query(
      `INSERT INTO room_pets (room_id, pet_id, slot)
       VALUES ($1, $2, $3)
       ON CONFLICT (room_id, pet_id) DO NOTHING
       RETURNING slot`,
      [room.id, petId, slot]
    );

    const finalSlot = result.rows[0]?.slot ?? slot;

    // Obtener datos completos de la mascota para el broadcast
    const fullPet = await pool.query(
      'SELECT id, species, breed, collar, name, created_at FROM pets WHERE id = $1',
      [petId]
    );

    // Notificar a todos los clientes WS de esta sala
    broadcast(code, { type: 'pet_added', pet: { ...fullPet.rows[0], slot: finalSlot } });

    return res.status(201).json({ pet: { ...fullPet.rows[0], slot: finalSlot } });
  } catch (err) {
    console.error('[rooms/addPet]', err.message);
    return res.status(500).json({ error: 'No se pudo agregar la mascota a la sala.' });
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
    const result = await pool.query(
      'DELETE FROM room_pets rp USING rooms r WHERE r.id = rp.room_id AND r.code = $1 AND r.owner_id = $2 RETURNING rp.pet_id',
      [code, req.user.id]
    );
    if (result.rows.length === 0) {
      // Verificar si la sala existe o si no es el dueño
      const roomCheck = await pool.query('SELECT owner_id FROM rooms WHERE code = $1', [code]);
      if (!roomCheck.rows[0]) return res.status(404).json({ error: 'Sala no encontrada.' });
      return res.status(403).json({ error: 'Solo el dueño puede vaciar la sala.' });
    }

    broadcast(code, { type: 'room_cleared' });
    return res.json({ cleared: true });
  } catch (err) {
    console.error('[rooms/clear]', err.message);
    return res.status(500).json({ error: 'No se pudo vaciar la sala.' });
  }
});

export default router;
