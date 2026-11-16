import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no está definida. Copia .env.example a .env y completa los valores.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Error inesperado en cliente idle:', err.message);
});

// Verificación de conexión al iniciar
pool.query('SELECT 1').then(() => {
  console.log('[DB] PostgreSQL conectado.');
}).catch((err) => {
  console.error('[DB] No se pudo conectar a PostgreSQL:', err.message);
  process.exit(1);
});

export default pool;
