/**
 * Ejecuta el schema.sql contra la base de datos.
 * Uso: node src/db/migrate.js
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Client } = pg;

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL no definida. Revisa tu archivo .env');
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();
    console.log('[migrate] Conectado a PostgreSQL.');

    const sql = await readFile(join(__dirname, 'schema.sql'), 'utf8');
    await client.query(sql);

    console.log('[migrate] ✓ Esquema aplicado correctamente.');
  } catch (err) {
    console.error('[migrate] Error al aplicar esquema:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
