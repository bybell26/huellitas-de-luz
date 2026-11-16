import { Router } from 'express';
import pool from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Valores permitidos — espejo de pets.js del frontend
const VALID_SPECIES = ['perro', 'gato'];
const VALID_BREEDS = {
  perro: ['labrador', 'husky', 'corgi', 'pug', 'poodle', 'dalmata'],
  gato:  ['siames', 'persa', 'bengali', 'britanico', 'maine', 'sphynx'],
};
const VALID_COLLARS = ['#a77fff', '#6fe1cf', '#ff8b88', '#73a7fc', '#ffc96d', '#33435c'];

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
      `SELECT id, species, breed, collar, name, created_at
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
  const { id, species, breed, collar, name } = req.body ?? {};
  const error = validatePet({ id, species, breed, collar, name: name ?? '' });
  if (error) return res.status(400).json({ error });

  try {
    const result = await pool.query(
      `INSERT INTO pets (id, user_id, species, breed, collar, name)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING
       RETURNING id, species, breed, collar, name, created_at`,
      [id, req.user.id, species, breed, collar, (name ?? '').trim()]
    );

    // Si ON CONFLICT disparó (mascota ya existía), devolvemos la existente
    if (result.rows.length === 0) {
      const existing = await pool.query(
        'SELECT id, species, breed, collar, name, created_at FROM pets WHERE id = $1',
        [id]
      );
      return res.json({ pet: existing.rows[0], duplicate: true });
    }

    return res.status(201).json({ pet: result.rows[0] });
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
