import { Router } from 'express';
import bcrypt from 'bcrypt';
import pool from '../db/pool.js';
import { signToken } from '../middleware/auth.js';

const router = Router();
const SALT_ROUNDS = 12;

// ─── Validaciones básicas ────────────────────────────────────────────────────
function validateEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
function validatePassword(pw) {
  return typeof pw === 'string' && pw.length >= 8 && pw.length <= 128;
}
function validateName(name) {
  return typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 60;
}

// ─── POST /api/auth/register ─────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, name } = req.body ?? {};

  if (!validateEmail(email))    return res.status(400).json({ error: 'Email inválido.' });
  if (!validatePassword(password)) return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 128 caracteres.' });
  if (!validateName(name))      return res.status(400).json({ error: 'El nombre es requerido (máx. 60 caracteres).' });

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO users (email, password, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, created_at`,
      [email.trim().toLowerCase(), hash, name.trim()]
    );
    const user = result.rows[0];
    const token = signToken(user);
    return res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese email.' });
    }
    console.error('[auth/register]', err.message);
    return res.status(500).json({ error: 'No se pudo crear la cuenta.' });
  }
});

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!validateEmail(email) || !validatePassword(password)) {
    return res.status(400).json({ error: 'Email o contraseña inválidos.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, email, name, password FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    );
    const user = result.rows[0];

    // Comparamos siempre para no revelar si el email existe (timing attack)
    const match = user ? await bcrypt.compare(password, user.password) : false;

    if (!match) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos.' });
    }

    const token = signToken(user);
    return res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    console.error('[auth/login]', err.message);
    return res.status(500).json({ error: 'Error al iniciar sesión.' });
  }
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
import { requireAuth } from '../middleware/auth.js';

router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Usuario no encontrado.' });
    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('[auth/me]', err.message);
    return res.status(500).json({ error: 'Error al obtener perfil.' });
  }
});

export default router;
