import { Router } from 'express';
import pool from '../db/pool.js';
import { validateAppearance } from '../services/appearance.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Valores permitidos — espejo de pets.js del frontend
const VALID_SPECIES = ['perro', 'gato'];
const VALID_BREEDS = {
  perro: ['labrador', 'husky', 'corgi', 'pug', 'poodle', 'dalmata'],
  gato:  ['siames', 'persa', 'bengali', 'britanico', 'maine', 'sphynx'],
};
const VALID_COLLARS = ['#a77fff', '#6fe1cf', '#ff8b88', '#73a7fc', '#ffc96d', '#33435c'];
const ACTIVITIES = ['feed', 'play', 'bath', 'style'];
async function activityBalance(db, petId) {
  const result = await db.query('SELECT action, count(*)::int AS used FROM pet_activities WHERE pet_id = $1 GROUP BY action', [petId]);
  return Object.fromEntries(ACTIVITIES.map(action => [action, Math.max(0, 5 - (result.rows.find(row => row.action === action)?.used || 0))]));
}

router.get('/:id/activities', requireAuth, async (req, res) => {
  try {
    const pet = await pool.query('SELECT id FROM pets WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!pet.rowCount) return res.status(404).json({ error: 'Mascota no encontrada.' });
    return res.json({ remaining: await activityBalance(pool, req.params.id) });
  } catch (err) {
    console.error('[pets/activities]', err.message);
    return res.status(500).json({ error: 'No se pudieron cargar las actividades.' });
  }
});

router.post('/:id/activities', requireAuth, async (req, res) => {
  const { action, requestId, appearance, collar } = req.body ?? {};
  if (!ACTIVITIES.includes(action) || typeof requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
    return res.status(400).json({ error: 'Actividad o identificador inválido.' });
  }
  if (action === 'style' && (!appearance || !validateAppearance(appearance) || !VALID_COLLARS.includes(collar))) {
    return res.status(400).json({ error: 'Estilo inválido.' });
  }
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const found = await client.query('SELECT id, species, breed, collar, name, appearance FROM pets WHERE id = $1 AND user_id = $2 FOR UPDATE', [req.params.id, req.user.id]);
    if (!found.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Mascota no encontrada.' }); }
    let pet = found.rows[0];
    const previous = await client.query('SELECT action FROM pet_activities WHERE pet_id = $1 AND request_id = $2', [pet.id, requestId]);
    if (previous.rowCount && previous.rows[0].action !== action) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'El identificador ya corresponde a otra actividad.' });
    }
    if (!previous.rowCount) {
      const remaining = await activityBalance(client, pet.id);
      if (!remaining[action]) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Agotaste los 5 usos gratuitos. El precio aún está por definir.', remaining });
      }
      if (action === 'style') {
        const same = collar === pet.collar && Object.keys({ ...pet.appearance, ...appearance }).every(key => (pet.appearance[key] || 'breed') === (appearance[key] || 'breed'));
        if (same) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Elige un estilo diferente antes de guardar.' }); }
        pet = (await client.query('UPDATE pets SET appearance = $2::jsonb, collar = $3 WHERE id = $1 RETURNING id, species, breed, collar, name, appearance', [pet.id, JSON.stringify(appearance), collar])).rows[0];
      }
      await client.query('INSERT INTO pet_activities (pet_id, request_id, action) VALUES ($1, $2, $3)', [pet.id, requestId, action]);
    }
    const remaining = await activityBalance(client, pet.id);
    await client.query('COMMIT');
    return res.json({ pet, remaining, action, duplicate: !!previous.rowCount });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('[pets/activity]', err.message);
    return res.status(500).json({ error: 'No se pudo completar la actividad. Puedes reintentar.' });
  } finally { client?.release(); }
});

function validatePet({ id, species, breed, collar, name }) {
  if (typeof id !== 'string' || !/^pey-[A-Za-z0-9_-]+$/.test(id)) return 'ID de mascota inválido.';
  if (!VALID_SPECIES.includes(species))                              return 'Especie inválida.';
  if (!VALID_BREEDS[species]?.includes(breed))                      return 'Raza inválida para esa especie.';
  if (!VALID_COLLARS.includes(collar))                              return 'Color de collar inválido.';
  if (typeof name !== 'string' || name.length > 16)                 return 'Nombre demasiado largo (máx. 16 caracteres).';
  return null;
}

// ─── GET /api/pets — mascotas del usuario autenticado ────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, species, breed, collar, name, appearance, created_at
       FROM pets
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [req.user.id]
    );
    return res.json({ pets: result.rows });
  } catch (err) {
    console.error('[pets/list]', err.message);
    return res.status(500).json({ error: 'No se pudieron obtener las mascotas.' });
  }
});

// ─── POST /api/pets — guardar mascota tras pago aprobado ─────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { id, species, breed, collar, name, appearance = {} } = req.body ?? {};
  if (!validateAppearance(appearance)) return res.status(400).json({ error: 'Apariencia inválida.' });
  const error = validatePet({ id, species, breed, collar, name: name ?? '' });
  if (error) return res.status(400).json({ error });

  try {
    const existing = await pool.query(
      'SELECT id, species, breed, collar, name, appearance, created_at FROM pets WHERE id = $1 AND user_id = $2', [id, req.user.id]
    );
    if (existing.rows.length) return res.json({ pet: existing.rows[0], duplicate: true });
    // El recibo se consume junto con la inserción; no puede usarse dos veces.
    const result = await pool.query(
      `WITH receipt AS (
         UPDATE payment_receipts SET redeemed_at = now()
         WHERE transaction_id = $7 AND user_id = $2 AND redeemed_at IS NULL
           AND qr_id IN (SELECT qr_id FROM payment_requests WHERE purpose = 'creation' AND user_id = $2)
         RETURNING transaction_id
       )
       INSERT INTO pets (id, user_id, species, breed, collar, name, appearance)
       SELECT $1, $2, $3, $4, $5, $6, $8::jsonb FROM receipt
       ON CONFLICT (id) DO NOTHING
       RETURNING id, species, breed, collar, name, appearance, created_at`,
      [id, req.user.id, species, breed, collar, (name ?? '').trim(), id.slice(4), JSON.stringify(appearance)]
    );
    if (result.rows.length) return res.status(201).json({ pet: result.rows[0] });
    const retry = await pool.query(
      'SELECT id, species, breed, collar, name, appearance, created_at FROM pets WHERE id = $1 AND user_id = $2', [id, req.user.id]
    );
    if (retry.rows.length) return res.json({ pet: retry.rows[0], duplicate: true });
    return res.status(403).json({ error: 'Se requiere un pago aprobado de tu cuenta que no haya sido utilizado.' });
  } catch (err) {
    console.error('[pets/create]', err.message);
    return res.status(500).json({ error: 'No se pudo guardar la mascota.' });
  }
});

// ─── DELETE /api/pets/:id — eliminar mascota propia ──────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  const petId = req.params.id;

  try {
    const result = await pool.query(
      'DELETE FROM pets WHERE id = $1 AND user_id = $2 RETURNING id',
      [petId, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mascota no encontrada o no te pertenece.' });
    }
    return res.json({ deleted: petId });
  } catch (err) {
    console.error('[pets/delete]', err.message);
    return res.status(500).json({ error: 'No se pudo eliminar la mascota.' });
  }
});

export default router;
