import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcrypt';
import pool from '../src/db/pool.js';

// Herramienta local de administración; no existe una ruta pública para cambiar claves.
export async function resetPassword(email) {
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Indica un correo válido.');
  const password = randomBytes(18).toString('base64url');
  const hash = await bcrypt.hash(password, 12);
  const result = await pool.query('UPDATE users SET password = $1 WHERE email = $2 RETURNING id, email', [hash, email.trim().toLowerCase()]);
  if (!result.rows.length) throw new Error('No existe una cuenta con ese correo en esta base local.');
  return { user: result.rows[0], password };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await resetPassword(process.argv[2]);
    console.log('Cuenta: ' + result.user.email);
    console.log('Nueva contraseña: ' + result.password);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
