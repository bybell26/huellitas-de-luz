-- Huellitas de Luz — Esquema PostgreSQL
-- Ejecutar con: psql -d huellitas -f schema.sql

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Usuarios ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT        UNIQUE NOT NULL,
  password   TEXT        NOT NULL,
  name       TEXT        NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Mascotas ────────────────────────────────────────────────────────────────
-- id = "pey-{transaction.id}" para mantener compatibilidad con el flujo actual
CREATE TABLE IF NOT EXISTS pets (
  id         TEXT        PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  species    TEXT        NOT NULL CHECK (species IN ('perro', 'gato')),
  breed      TEXT        NOT NULL,
  collar     TEXT        NOT NULL,
  name       TEXT        NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pets_user_id_idx ON pets(user_id);

-- ─── Salas de constelación ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code       TEXT        UNIQUE NOT NULL,
  owner_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL DEFAULT 'Mi constelación',
  max_pets   INTEGER     NOT NULL DEFAULT 42,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rooms_code_idx ON rooms(code);
CREATE INDEX IF NOT EXISTS rooms_owner_id_idx ON rooms(owner_id);

-- ─── Mascotas en sala ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS room_pets (
  room_id    UUID        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  pet_id     TEXT        NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  slot       INTEGER     NOT NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, pet_id),
  UNIQUE (room_id, slot)
);

CREATE INDEX IF NOT EXISTS room_pets_room_id_idx ON room_pets(room_id);
